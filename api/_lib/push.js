const { supabase } = require('./supabase');

// api/_lib/push.js — shared server-side push fan-out (used by verify.js + reports.js
// to fire AUTOMATIC, event-driven notifications — not the manual test button).
// DORMANT unless VAPID_* env vars are set; web-push missing or a dead subscription
// never throws to the caller (we prune 404/410 endpoints silently). This keeps the
// "notify the reporter when their clean-up is verified" loop a pure side-effect that
// can't break report verification.
//
// Two notifications that matter (the strategy):
//   * toUserByEmail(email, …)  -> the REPORTER, on verification ("your report was
//     verified ✅"). This is the emotional payoff + retention hook.
//   * toAdmins(…)              -> people in ADMIN_EMAILS env var, on a NEW report
//     ("a new report needs verification") so nothing sits un-reviewed.
// (A third, opt-in "verified clean-ups NEAR you" zone blast is v2 — it's the only
// one that needs a preference toggle, since it's ambient rather than about *your*
// action. The first two are always-on and privacy-respecting: you only get pings
// tied to reports you made or, for admins, your job.)
function configured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}
function adminEmails() {
  return (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}
async function sendToSubs(subs, payload) {
  if (!configured() || !subs || !subs.length) return { sent: 0, pruned: 0 };
  let webpush;
  try { webpush = require('web-push'); } catch (e) { return { sent: 0, pruned: 0 }; }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const body = JSON.stringify(payload);
  let sent = 0, pruned = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 86400 });
      sent++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) { await supabase.from('push_subscriptions').delete().eq('id', s.id).catch(() => {}); pruned++; }
    }
  }));
  return { sent, pruned };
}
async function subsForEmails(emails) {
  if (!emails || !emails.length) return [];
  // auth.users cannot be queried directly from public schema without an RPC.
  // Instead, we use the admin API (safe for demo scale).
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error || !users) return [];
  const targetEmails = emails.map(e => e.toLowerCase());
  const ids = users.filter(u => targetEmails.includes((u.email || '').toLowerCase())).map(u => u.id);
  if (!ids.length) return [];
  const { data: subs } = await supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('user_id', ids);
  return subs || [];
}
async function toUserByEmail(email, payload) {
  if (!email) return { sent: 0, pruned: 0 };
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error || !users) return { sent: 0, pruned: 0 };
  const target = email.toLowerCase();
  const user = users.find(u => (u.email || '').toLowerCase() === target);
  if (!user) return { sent: 0, pruned: 0 };
  const { data: subs } = await supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', user.id);
  return sendToSubs(subs, payload);
}
async function toAdmins(payload) {
  return sendToSubs(await subsForEmails(adminEmails()), payload);
}
module.exports = { configured, adminEmails, toUserByEmail, toAdmins };
