# EcoClean Connect — MVP

A **crowdsourced pollution-reporting and community clean-up platform** built as a
Progressive Web App (PWA). It runs in any browser on **iOS and Android** (and desktop),
and can be added to the home screen like a native app.

> Built by a student founder as a real, working prototype. The code is intentionally
> simple and heavily commented so its creator can understand, explain, and extend it.

## Features (MVP)
- **Geo-tagged reporting** — citizens tap a pin, take a photo, pick a category, and submit
  a pollution site (location auto-detected or entered manually).
- **Public map** — Leaflet + OpenStreetMap (no API key / no billing). Red pins = reported,
  green pins = verified clean-up. Before/after photos in the popup.
- **Admin verification** — an admin reviews the "before" photo, uploads an "after" photo,
  adds notes, and verifies. The pin flips red → green.
- **Reward engine (pilot)** — on verification, the admin can issue a manual voucher code
  (e.g. `MARJANE-AB12`), matching the proposal's "manual fulfillment" pilot workflow.
- **Community alerts** — admins post announcements shown at the top of the map.
- **Dashboard** — live stats (total / reported / verified) and breakdowns by category.

## Tech stack
- **Backend:** Node.js + Express + Multer (file uploads). Data stored in JSON files
  (no database server needed for an MVP).
- **Frontend:** Vanilla HTML/CSS/JS + Leaflet. Installable PWA via `manifest.json` + `sw.js`.
- **No native modules, no paid APIs** → installs and deploys anywhere for free.

## Run locally
```bash
npm install
npm start
# open http://localhost:3000
```
- Map: `http://localhost:3000/`
- Dashboard: `http://localhost:3000/dashboard.html`
- Admin: `http://localhost:3000/admin.html` → admin key is `ecoclean-admin`
  (set `ADMIN_KEY` env var to change it; on Render set it in the dashboard).

## Deploy free (so others can actually use it)
The repo includes a **`render.yaml` blueprint**, so Render can deploy the whole app
(frontend + backend) from this GitHub repo in a couple of clicks.

**Option A — let the assistant push for you (recommended)**
1. Create a free [GitHub](https://github.com) account (if you don't have one).
2. Generate a **fine-grained Personal Access Token**:
   GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens →
   Generate. Give it a name, set access to "All repositories" or just this one, and grant
   **"Repositories: Read and Write"**. Copy the token.
3. Paste the token to the assistant. It will create the repo and push the code.
4. Create a free [Render](https://render.com) account and connect your GitHub (one-time).
   Then either click the **Deploy to Render** button below, or Render → New → **Blueprint**
   → select the `ecoclean-connect` repo → Deploy.
5. In Render → **Environment**, set `ADMIN_KEY` to a secret of your choice (used by the
   admin panel). Done — you get a live `https://ecoclean-connect.onrender.com` URL.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/YOUR_GITHUB_USERNAME/ecoclean-connect)

**Option B — do it yourself**
1. Push this folder to a GitHub repo.
2. In Render, New → **Blueprint** → connect the repo → Deploy (uses `render.yaml`).
3. Set `ADMIN_KEY` in Render → Environment.

> **Notes:** Render's free filesystem is ephemeral, so uploaded photos reset on redeploy.
> For production, swap JSON storage for Postgres/Supabase and photos for object storage.
> HTTPS is automatic on Render, which is required for phone geolocation + "add to home screen".

## Founder notes (for college applications)
This is a **genuine prototype you can own and explain**:
- You designed the data model (reports with before/after photos, status, reward).
- You chose a PWA so it works on both iOS and Android without App Store friction.
- You used open-source maps to keep it free to run.
- Next honest steps you can do yourself (and talk about): add user accounts, swap JSON for
  a real database (Supabase), add SMS voucher delivery, and run a real pilot in one Casablanca
  neighborhood. Each is a concrete engineering decision you can describe in an interview.

## Project structure
```
ecoclean-connect/
├── server.js            # Express API + static hosting
├── package.json
├── data/                # JSON "database" (reports.json, alerts.json)
├── uploads/             # user photos (gitignored)
└── public/
    ├── index.html       # map + report flow (citizen app)
    ├── admin.html       # verify + reward + alerts
    ├── dashboard.html   # stats
    ├── css/styles.css
    ├── js/{app,admin,dashboard}.js
    ├── manifest.json    # PWA config
    ├── sw.js            # service worker (offline shell)
    └── icon.svg
```
