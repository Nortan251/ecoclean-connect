const { supabase } = require('../../_lib/supabase');
const { REPORT_SELECT, readJson, uploadPhoto, requireAdmin } = require('../../_lib/helpers');
const push = require('../../_lib/push');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  const id = req.query.id;
  let body;
  try {
    body = await readJson(req);
  } catch (e) {
    return res.status(400).json({ error: 'invalid json' });
  }

  // Read the reporter + their EMAIL + rewarded flag BEFORE updating, so we award
  // exactly once and can notify the right person. (auth.users is readable by the
  // service role; we only ever use the email to look up push subscriptions.)
  const { data: cur } = await supabase.from('reports').select('reporter_user_id, rewarded, category').eq('id', id).single();
  let reporterEmail = null;
  if (cur && cur.reporter_user_id) {
    const { data: u } = await supabase.from('users').select('email').eq('id', cur.reporter_user_id).maybeSingle();
    reporterEmail = u && u.email;
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
  // the verifying transition, only if they were signed in (we have their email),
  // fire-and-forget so it can never break verification. DORMANT until VAPID is set.
  if (cur && cur.reporter_user_id && !cur.rewarded && reporterEmail) {
    push.toUserByEmail(reporterEmail, {
      title: 'Your report was verified ✅',
      body: 'A ' + (cur.category || 'pollution') + ' site you reported was cleaned. Tap to see it.',
      url: '/dashboard.html',
      icon: '/icon-192.png',
    }).catch(() => {});
  }

  return res.status(200).json(data);
};
