---
title: EcoClean Connect
emoji: 🌱
colorFrom: green
colorTo: white
sdk: docker
app_port: 7860
---

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

## Deploy free (NO credit card required)
> **Render now asks for a card even on its free tier, and Glitch shut down in 2025.**
> The options below are free and do **not** require a bank card.

### Easiest: Replit (free, no card)
1. Give the assistant a GitHub fine-grained token (or create the repo yourself). The
   assistant pushes all files to GitHub. (GitHub itself is free, no card.)
2. Sign up at [replit.com](https://replit.com) with Google/GitHub — **no card needed**.
3. **New Repl → Import from GitHub →** pick `ecoclean-connect` → wait for the import.
4. Click **Run**. Replit runs `npm start` and gives a public URL
   (`https://<repl>.<user>.repl.co` or `.replit.app`). Share that link.
   - The free **Run** URL is enough for a pilot/demo. (Replit's *Deployments*
     always-on URL is a paid add-on — not required to be live.)
5. Admin key defaults to `ecoclean-admin`. To set your own: Repl → 🔒 **Secrets** →
   add `ADMIN_KEY` = your secret.

### Robust alternative: Hugging Face Spaces (free, no card, persistent URL)
HF Spaces hosts Docker apps for free, no card. Ask the assistant to add a `Dockerfile`
and Space config; then create a Space, link the GitHub repo, and you get a persistent
`https://<user>-<space>.hf.space` URL. Best if you want an always-on link without paying.

### If you get a card later: Render
Use the included `render.yaml` blueprint (Render → New → Blueprint → repo → Deploy).
Better for a real pilot (always-on, custom domain), but needs a card to verify.

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
