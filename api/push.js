const { supabase } = require('./_lib/supabase');
const { verifyUser } = require('./_lib/auth');

// /api/push/* — ONE serverless function (Vercel Hobby cap = 12 functions, so we
// route four logical endpoints by SUBPATH via `req.query.id` instead of four
// files). Vercel maps /api/push/<x> here with query.id === '<x>' (same catch-all
// pattern as api/reports/[id]/verify.js).
//   GET  /api/push/vapid-public  -> the VAPID public key (503 if not configured)
//   POST /api/push/subscribe     -> upsert the caller's PushSubscription
//   POST /api/push/unsubscribe   -> delete the caller's subscription(s)
//   POST /api/push/send          -> fan a notification to the caller's subs (test
//                                   trigger; auto-on-verify is a follow-up). Prunes
//                                   dead endpoints (404/410).
// Web push stays DORMANT until VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
// are set in Vercel (see PUSH_SETUP.md); until then vapid-public + send 503 and the
// UI shows "not configured" instead of a broken button.
const configured = () =>
  !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);

function readBody(req) { try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; } }

async function vapidPublic(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!configured()) return res.status(503).json({ error: 'push not configured', hint: 'set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT in Vercel' });
  return res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY });
}

async function subscribe(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'not signed in' });
  const body = readBody(req);
  const sub = body.subscription || {};
  const endpoint = sub.endpoint, keys = sub.keys || {};
  if (!endpoint || !keys.p256dh || !keys.auth) return res.status(400).json({ error: 'subscription missing endpoint/keys' });
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, city: body.city || null,
  }, { onConflict: 'user_id,endpoint' });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}

async function unsubscribe(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'not signed in' });
  const body = readBody(req);
  let q = supabase.from('push_subscriptions').delete().eq('user_id', user.id);
  if (body.endpoint) q = q.eq('endpoint', body.endpoint);
  const { error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}

async function send(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!configured()) return res.status(503).json({ error: 'push not configured' });
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'not signed in' });
  const body = readBody(req);
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
}

module.exports = async (req, res) => {
  switch (req.query.id) {
    case 'vapid-public': return vapidPublic(req, res);
    case 'subscribe': return subscribe(req, res);
    case 'unsubscribe': return unsubscribe(req, res);
    case 'send': return send(req, res);
    default: return res.status(404).json({ error: 'unknown push route', routes: ['vapid-public', 'subscribe', 'unsubscribe', 'send'] });
  }
};
