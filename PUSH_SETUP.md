# 🔔 Web Push setup (one-time, ~60 seconds)

Web push is **fully coded** (client card, service-worker handlers, server
endpoints, SQL). It stays *dormant* until you add 3 env vars + run one SQL file,
because VAPID keys are **secrets you must generate yourself** (I can't create your
private key). Until then the dashboard "Alerts near you" card simply says
*"Alerts aren't configured on the server yet"* — nothing is broken.

## 1. Generate a VAPID key pair
On your machine (Node is already a dependency of this repo):
```bash
npx web-push generate-vapid-keys
```
It prints a `Public Key` and a `Private Key` (both base64 strings).

## 2. Add 3 env vars in Vercel
Project → **Settings → Environment Variables**, add for *Production* (and Preview if you want):
- `VAPID_PUBLIC_KEY` = the public key from step 1
- `VAPID_PRIVATE_KEY` = the private key from step 1
- `VAPID_SUBJECT` = `mailto:you@example.com`  (any email; required by the push spec)

Then **redeploy** (Vercel → Deployments → Redeploy, or push any commit) so the
functions pick up the new env + install the `web-push` npm dependency.

## 3. Create the subscriptions table
In **Supabase → SQL Editor**, run the contents of `supabase/accounts_part4.sql`
(creates `push_subscriptions` + owner-only RLS). Idempotent.

## 4. (Optional, for the streak multiplier) run `supabase/accounts_part3.sql`
This adds the server-side streak columns + the `record_daily_activity` /
`apply_streak_bonus` RPCs. The streak card works without it (client-side), but
the *synced* badge + the verification **point-multiplier** need this file. The
server code is guarded, so if you skip it nothing errors — you just don't get the
server streak yet.

## 5. Test it
Dashboard → **Alerts near you** → *Turn on alerts* → allow notifications →
*Send me a test alert*. A notification should pop. ✅

---
### How the auto-send will work (next step, not yet wired)
Right now `/api/push/send` is a manual/test trigger. To fire alerts automatically
("a report near you was verified"), call the same `web-push` fan-out from
`api/reports/[id]/verify.js`: read `push_subscriptions` whose `city` matches the
report's city and send to them. The plumbing (table, keys, SW handler, payload
shape) is all already in place — only the trigger line is missing by design.
