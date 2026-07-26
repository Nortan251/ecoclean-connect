const { supabase } = require('../_lib/supabase');
const { verifyUser } = require('../_lib/auth');

// /api/push/subscribe — store (upsert) the caller's PushSubscription so we can
// send them alerts. Requires a valid token; the user_id is taken from the token
// (never the body) so a client can't subscribe someone else. We keep at most one
// row per (user, endpoint) so re-subscribing from the same device updates keys.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'not signed in' });
  let body;
  try { body = JSON.parse(req.body || '{}'); } catch (e) { return res.status(400).json({ error: 'invalid json' }); }
  const sub = body.subscription || {};
  const endpoint = sub.endpoint, keys = sub.keys || {};
  if (!endpoint || !keys.p256dh || !keys.auth) return res.status(400).json({ error: 'subscription missing endpoint/keys' });
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    city: body.city || null,
  }, { onConflict: 'user_id,endpoint' });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
};
