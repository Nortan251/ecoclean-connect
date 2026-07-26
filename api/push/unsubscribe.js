const { supabase } = require('../_lib/supabase');
const { verifyUser } = require('../_lib/auth');

// /api/push/unsubscribe — remove the caller's subscription matching an endpoint
// (or all of them if no endpoint given). Token-bound user_id, as always.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'not signed in' });
  let body = {};
  try { body = JSON.parse(req.body || '{}'); } catch (e) {}
  let q = supabase.from('push_subscriptions').delete().eq('user_id', user.id);
  if (body.endpoint) q = q.eq('endpoint', body.endpoint);
  const { error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
};
