# EcoClean Connect — MVP

A **crowdsourced pollution-reporting and community clean-up platform** built as a
Progressive Web App (PWA). It runs in any browser on **iOS and Android**, installs to
the home screen, and ships in **English / French / Arabic** (Arabic is right-to-left).

> Built by a student founder as a real, working prototype.

## Features
- Landing screen + map, geo-tagged reporting (photo + GPS + category)
- Public map (red = reported, green = verified) with before/after photos
- Admin verification + manual reward vouchers
- Community alerts + live dashboard
- EN / FR / AR language switcher with RTL layout

## Architecture
- **Frontend:** static PWA (vanilla HTML/CSS/JS + Leaflet) at the repo root.
- **Backend:** Vercel serverless functions in `api/` (Node).
- **Database + storage:** Supabase (Postgres + Storage bucket `ecoclean`).
- No long-running server, no credit card required to deploy.

## Environment variables (set in Vercel)
- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role key (server-only, never expose)

## Database setup (one time)
In Supabase → **SQL Editor**, run `supabase/schema.sql` (creates `reports` + `alerts`
tables). Create the Storage bucket `ecoclean` (public) in Supabase → **Storage**.

## Deploy (Vercel — free, no card, no watermark)
1. Push this repo to GitHub.
2. Vercel → **Add New → Project → Import** `ecoclean-connect` from GitHub.
3. Add the two env vars above (Project → Settings → Environment Variables).
4. Deploy → you get `https://<project>.vercel.app` (clean, no "made with" badge).
5. Every `git push` redeploys automatically.

## Local development
`npm install`, then run the Vercel CLI with `vercel dev`. Set the env vars in a local
`.env` file (gitignored) for testing.

## Founder notes (for college applications)
You designed the data model, chose a PWA for iOS+Android without App Store friction,
used open-source maps, and integrated a real Postgres backend (Supabase). Honest next
steps: run a 1-neighborhood Casablanca pilot, add SMS voucher delivery, add user accounts.

## Project structure
```
index.html  admin.html  dashboard.html  manifest.json  sw.js  icon.svg
css/   js/ (i18n.js, app.js, admin.js, dashboard.js)
api/   serverless functions: reports, [id]/verify, stats, alerts
supabase/schema.sql
```
