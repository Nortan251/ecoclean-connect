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

  const patch = { status: 'verified', verified_at: new Date().toISOString() };
  if (body.notes) patch.verification_notes = body.notes;
  if (body.photo) {
    try {
      patch.after_photo = await uploadPhoto(body.photo);
    } catch (e) {
      /* keep going without after-photo if upload fails */
    }
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
  return res.status(200).json(data);
};
