/* seed/seed-associations.js — seed example partner associations so the public
 * "Our network" page (/associations.html) shows the multi-city model populated.
 * Run: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node seed/seed-associations.js
 * Idempotent (skips names that already exist). These are DEMO orgs illustrating how
 * each city gets its own scoped association; a real rollout replaces them. The
 * network page computes each city's stats client-side from /api/reports, so the
 * numbers stay live without a new endpoint (keeps us at the 12-function cap). */
'use strict';
const { createClient } = require('@supabase/supabase-js');
const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.'); process.exit(1); }
let WS; try { WS = require('ws'); } catch (e) {}
const supabase = createClient(URL, KEY, WS ? { realtime: { transport: WS } } : undefined);

// [name, city, lat, lng, radius_km, contact_email]
const ORGS = [
  ['Agadir Cleaners', 'Agadir', 30.4278, -9.5981, 25, 'hello@agadir-cleaners.ma'],
  ['Marrakech Propre', 'Marrakech', 31.6295, -7.9811, 30, 'contact@marrakech-propre.ma'],
  ['Tanger Vert', 'Tangier', 35.7595, -5.8340, 25, 'salam@tanger-vert.ma'],
  ['Rabat Nadiya', 'Rabat', 34.0209, -6.8416, 25, 'marhaba@rabat-nadiya.ma'],
];

(async () => {
  let added = 0, skipped = 0;
  for (const [name, city, lat, lng, radius_km, contact_email] of ORGS) {
    const { data: ex } = await supabase.from('associations').select('id').eq('name', name).limit(1);
    if (ex && ex.length) { skipped++; console.log('  skip (exists): ' + name); continue; }
    const { error } = await supabase.from('associations').insert({ name, city, lat, lng, radius_km, contact_email });
    if (error) { console.error('  FAIL ' + name + ': ' + error.message); }
    else { added++; console.log('  added: ' + name + ' (' + city + ')'); }
  }
  console.log(`\n✅ Associations: ${added} added, ${skipped} already present.`);
  console.log('Open /associations.html — the network should list these cities with live stats.');
})().catch((e) => { console.error('SEED ERROR:', e.message); process.exit(1); });
