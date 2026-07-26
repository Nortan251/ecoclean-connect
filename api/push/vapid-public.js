// /api/push/vapid-public — return the VAPID *public* key (safe to expose) so the
// browser can subscribe. The PUBLIC key is not a secret; the PRIVATE key stays in
// Vercel env (VAPID_PRIVATE_KEY) and is never returned here. If VAPID isn't
// configured we 503 so the UI can show "notifications need setup" instead of a
// broken button. (Setup steps: see PUSH_SETUP.md.)
function configured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();
  if (!configured()) return res.status(503).json({ error: 'push not configured', hint: 'set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT in Vercel' });
  return res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY });
};
