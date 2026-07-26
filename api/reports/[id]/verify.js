const { supabase } = require('../../_lib/supabase');
const { REPORT_SELECT, readJson, uploadPhoto, requireAdmin } = require('../../_lib/helpers');

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

  // Read the reporter + rewarded flag BEFORE updating, so we award exactly once.
  const { data: cur } = await supabase.from('reports').select('reporter_user_id, rewarded').eq('id', id).single();

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

  return res.status(200).json(data);
};
