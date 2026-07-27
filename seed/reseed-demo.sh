#!/usr/bin/env bash
# seed/reseed-demo.sh — ONE command to fill the demo with believable Agadir data
# + the 4 partner associations, so /impact.html, the map and /associations.html
# look alive for a committee / screenshot session.
#
#   SUPABASE_URL=https://jusxrlmjhffnhmxhfxga.supabase.co \
#   SUPABASE_SERVICE_ROLE_KEY=<paste service_role key> \
#   bash seed/reseed-demo.sh
#
# Idempotent: the seeders skip if their data already exists (run seed/cleanup.js
# first if you want a truly fresh re-seed). The service_role key is read from the
# environment only — it is NEVER stored in this file.
set -e
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first."
  echo "  (Supabase -> Settings -> API -> service_role key. Rotate it after the demo.)"
  exit 1
fi
if [ ! -d node_modules/@supabase/supabase-js ]; then
  echo "Installing dependencies..."
  npm i --no-audit --no-fund >/dev/null 2>&1
fi
echo "Seeding reports + photos..."
node seed/seed-data.js
echo "Seeding partner associations..."
node seed/seed-associations.js
echo ""
echo "Done. Open /impact.html and /associations.html — the demo is alive."
echo "To wipe again later: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node seed/cleanup.js"
