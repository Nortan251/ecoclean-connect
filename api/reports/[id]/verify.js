const { supabase } = require('../../_lib/supabase');
const { REPORT_SELECT, readJson, uploadPhoto, requireAdminContext, adminContextOrNull, inCityBounds } = require('../../_lib/helpers');
const { verifyUser } = require('../../_lib/auth');
const push = require('../../_lib/push');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const id = req.query.id;
  let body;
  try {
    body = await readJson(req);
  } catch (e) {
    return res.status(400).json({ error: 'invalid json' });
  }

  // --- RALLY LOGIC (Any logged-in user can RSVP) ---
  if (body.action === 'rally_update') {
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'login required for rallies' });
    const { data, error } = await supabase
      .from('reports')
      .update({ description: body.new_desc })
      .eq('id', id)
      .select(REPORT_SELECT)
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // --- ADMIN LOGIC (Verify / Reject) ---
  const ac = await requireAdminContext(req, res);   
  if (!ac.ok) return;

  // Read the reporter + their EMAIL + rewarded flag BEFORE updating, so we award
  // exactly once and can notify the right person. (auth.users is readable by the
  // service role; we only ever use the email to look up push subscriptions.)
  const { data: cur } = await supabase.from('reports').select('reporter_user_id, rewarded, category, lat, lng').eq('id', id).single();
  // admin v2: an association admin may only verify reports inside their city.
  if (ac.kind === 'assoc' && ac.ctx && (!cur || !inCityBounds(cur, ac.ctx))) {
    return res.status(403).json({ error: 'outside your association’s city' });
  }
  let reporterEmail = null;
  if (cur && cur.reporter_user_id) {
    const { data: { user } } = await supabase.auth.admin.getUserById(cur.reporter_user_id);
    reporterEmail = user && user.email;
  }

  // The 'rally_update' action allows any authenticated user to RSVP to a rally,
  // storing the data gracefully inside the description field to bypass schema limits.
  // Note: ac.ok check applies to verification/rejects, but rally is community-driven.
  // Wait, we forced requireAdminContext at the top. Let's fix that.

  if (body.action === 'reject') {
    const { data, error } = await supabase
      .from('reports')
      .update({ status: 'rejected', verification_notes: body.notes || 'Rejected by admin' })
      .eq('id', id)
      .select(REPORT_SELECT)
      .single();
    if (error) return res.status(500).json({ error: error.message });

    if (cur && cur.reporter_user_id && reporterEmail) {
      await push.toUserByEmail(reporterEmail, {
        title: 'Report Rejected ❌',
        body: 'A report you submitted could not be verified and was marked as invalid.',
        url: '/dashboard.html',
        icon: '/icon-192.png',
      }).catch(() => {});
    }
    return res.status(200).json(data);
  }

  const patch = { status: 'verified', verified_at: new Date().toISOString(), rewarded: true };
  if (body.notes) patch.verification_notes = body.notes;
  if (body.photo) {
    try { patch.after_photo = await uploadPhoto(body.photo); } catch (e) { /* keep going without after-photo */ }
  }
  if (body.rewardCode) {
    patch.reward_code = body.rewardCode;
    patch.reward_issued = true;
  }

  const { data, error } = await supabase
    .from('reports')
    .update(patch)
    .eq('id', id)
    .select(REPORT_SELECT)
    .single();
  if (error) return res.status(500).json({ error: error.message });

  // Server-side, tamper-proof reward: credit the reporter (if they were signed in)
  // once, via a security-definer function that bypasses RLS.
  if (cur && cur.reporter_user_id && !cur.rewarded) {
    try { await supabase.rpc('award_points', { uid: cur.reporter_user_id, amt: 20 }); } catch (e) {}
    // Server-side streak v2: on top of the flat +20, grant a tiered streak bonus
    // (the "multiplier") read from the reporter's current streak. Guarded so a
    // missing RPC (migration not yet run) degrades to the flat reward only.
    try { await supabase.rpc('apply_streak_bonus', { uid: cur.reporter_user_id }); } catch (e) {}
  }

  // AUTO NOTIFICATION (the real feature): tell the REPORTER their clean-up was
  // verified — the "you made a difference" payoff that brings people back. Only on
  // the verifying transition, only if they were signed in (we have their email).
  if (cur && cur.reporter_user_id && !cur.rewarded && reporterEmail) {
    await push.toUserByEmail(reporterEmail, {
      title: 'Your report was verified ✅',
      body: 'A ' + (cur.category || 'pollution') + ' site you reported was cleaned. Tap to see it.',
      url: '/dashboard.html',
      icon: '/icon-192.png',
    }).catch(() => {});
  }

  return res.status(200).json(data);
};
