const { supabase } = require('../_lib/supabase');
const { verifyUser } = require('../_lib/auth');

// /api/push/send — fan a notification out to subscribers (v1: signed-in admin/test
// trigger; later this is called automatically on verification / new nearby report).
// Gated on VAPID config (503 otherwise). For each stored subscription we encrypt +
// POST via web-push; if a push endpoint is dead (404/410) we prune that row so we
// don't keep retrying ghosts. city (optional) restricts the blast to one zone.
//
// This is deliberately a *manual* endpoint in v1 — it proves the pipe end-to-end
// ("send me a test alert") without coupling to business events yet. Wiring it to
// "report verified near subscriber's city" is a follow-up (a trigger or an
// addition to verify.js that reads push_subscriptions by city).
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  if (!require0()) return res.status(503).json({ error: 'push not configured' });
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'not signed in' });

  let body = {};
  try { body = JSON.parse(req.body || '{}'); } catch (e) {}
  const title = body.title || 'EcoClean Connect';
  const text = body.text || 'There is new activity near you.';
  const url = body.url || '/dashboard.html';
  const city = body.city || null;

  let webpush;
  try { webpush = require('web-push'); } catch (e) { return res.status(503).json({ error: 'web-push not installed' }); }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

  let q = supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', user.id);
  if (city) q = q.eq('city', city);
  const { data: subs, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  const payload = JSON.stringify({ title, body: text, url, icon: '/icon-192.png' });
  let sent = 0, pruned = 0;
  await Promise.all((subs || []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 });
      sent++;
    } catch (e) {
      const code = e && e.statusCode;
      if (code === 404 || code === 410) { await supabase.from('push_subscriptions').delete().eq('id', s.id); pruned++; }
    }
  }));
  return res.status(200).json({ sent, pruned, total: (subs || []).length });
};

function require0() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}
