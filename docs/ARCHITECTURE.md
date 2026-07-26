# Architecture — EcoClean Connect

A short, honest engineering write-up of how EcoClean Connect is built and *why*.
For the human story and the "why it matters," see the README; for essay/interview
notes see the private `PORTFOLIO_ESSAY_NOTES.md` (not in this repo).

## Stack
- **Frontend:** static Progressive Web App — vanilla HTML/CSS + modular ES6, Leaflet
  maps, Chart.js, qrcodejs, leaflet.markercluster, leaflet.heat. No framework, no
  build step.
- **Backend:** Vercel serverless functions in `api/` — the *only* place the
  database secret (`SUPABASE_SERVICE_ROLE_KEY`) exists.
- **Data:** Supabase = Postgres (tables + Row-Level Security), Storage (photos),
  Auth (optional accounts), Realtime (live updates).

## Why a PWA in vanilla JS
The users are on low-end phones with spotty data. A PWA gives one codebase that
**installs on iOS and Android from the browser**, works **offline**, and ships a
tiny payload — no app store, no framework runtime. The trade-off (building my own
module structure, i18n, and state conventions) was deliberate: it forced me to
understand the constraints a framework would have hidden.

## Data flow (one report)
1. Client validates (size/type, rate-limit, EXIF freshness + GPS cross-check, XSS).
2. `POST /api/reports` — the server **verifies the Bearer token** (so it never
   trusts a client-supplied user id), uploads the photo to Storage, inserts the row.
3. Supabase **Realtime** pushes the new row to every open map (`postgres_changes`).
4. An admin verifies with an after-photo (`/api/reports/:id/verify`); if the report
   has an owner, a **server-side `SECURITY DEFINER` function** credits their points.
5. The wallet + leaderboard update live.

## Key design decisions
- **Anonymous-first, optional identity.** Reporting never requires login (civic
  participation + whistleblower safety). Accounts are a layer you *add* for
  ownership of your impact, not a gate you pass.
- **Trust the server, never the client id.** Identity comes from a verified access
  token; sensitive writes go through `SECURITY DEFINER` functions (`award_points`,
  `mint_voucher`) that bypass RLS atomically; **Row-Level Security** scopes each
  user to their own rows. Rewards are therefore **server-authoritative** — a client
  can read its balance but never mint it.
- **Offline-first, per resource.** Network-first for live data; a **bounded**
  cache-first for map tiles (an LRU-ish cap so panning can't exhaust the storage
  quota); stale-while-revalidate for assets; an **offline submit queue** with
  *survivor retention* (failed retries are kept) that even carries the auth token.
- **Extending without forking.** Marker clustering is added via a **transparent
  proxy** over the core layer group (a `setStyle` shim keeps the old recoloring
  code working); validation/anti-spam hook the form via **capture-phase** event
  interception so the core is untouched.
- **Sensor fusion + humane anti-fraud.** The live high-accuracy GPS is preferred
  over EXIF GPS; EXIF *timestamp* freshness is a fraud signal, but **missing
  metadata soft-passes** (privacy-stripped photos aren't punished), and the result
  is *shown* to the user so the rules read as guidance.
- **Data provenance over decoration.** The density heatmap is built **only** from
  real citizen reports; an illustrative "context" layer was deliberately removed so
  the map never shows fabricated data.
- **Inclusive by construction.** Arabic/French/English with full RTL; accessibility
  passes (skip-link, modal focus trap, live regions, reduced-motion); names are
  always set as text, never injected as HTML.
- **Abuse-resistant gamification.** Every quest needs a report target *and* a verify
  target; signed-in claims are validated server-side against community milestones
  (which require real human verifications) and recorded once.

## Repository map
```
index.html / dashboard.html / admin.html   # the three surfaces
css/styles.css                              # design system
js/  i18n · app · ecoclean-addons · camera-location · validation · photo-trust
     trust-system · map-sync · cluster · heatmap · map-place · offline-submit
     install-prompt · thankyou · opening · auth · account-ui · rewards
     gamification · analytics · admin · verification · dispatch · share
api/ reports · reports/[id]/verify · alerts · stats · me · mint · leaderboard
     quest-claim · config · _lib/{supabase, auth, helpers}
supabase/ schema.sql · realtime-rls.sql · accounts.sql · accounts_part2.sql
sw.js   # service worker (offline strategies)
```

## Run it
1. Supabase: run `supabase/schema.sql`, then `realtime-rls.sql`, then
   `accounts.sql` + `accounts_part2.sql`; create a public Storage bucket `ecoclean`.
2. Vercel env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (and `SUPABASE_ANON_KEY`
   for the browser client / realtime). For accounts: enable the Email provider,
   set the Site URL, and (for a demo) turn *off* email confirmation.
3. Deploy → the PWA is live; installable, offline-capable, trilingual.

*Built as a working prototype. Libraries credited: Leaflet, OpenStreetMap, CARTO,
Supabase, Chart.js, qrcodejs, leaflet.markercluster, leaflet.heat.*
