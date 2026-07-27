/* seed/cleanup.js — remove ALL demo/seed data so the live app is honest & empty.
 * Run: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node seed/cleanup.js
 * Deletes every report tagged [seed] AND every association (the 4 demo orgs), so the
 * public site shows real, empty state until the user explicitly re-seeds for a demo
 * (node seed/seed-data.js && node seed/seed-associations.js). Does NOT touch storage
 * objects (harmless orphans) or any non-seed reports. Idempotent. */
'use strict';
const { createClient } = require('@supabase/supabase-js');
const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.'); process.exit(1); }
let WS; try { WS = require('ws'); } catch (e) {}
const supabase = createClient(URL, KEY, WS ? { realtime: { transport: WS } } : undefined);

(async () => {
  const { data: seedReports } = await supabase.from('reports').select('id').ilike('description', '%[seed]%');
  const rIds = (seedReports || []).map((r) => r.id);
  let rDel = 0;
  if (rIds.length) { const { error } = await supabase.from('reports').delete().in('id', rIds); if (error) console.error('reports delete error:', error.message); else rDel = rIds.length; }
  const { data: assocs } = await supabase.from('associations').select('id');
  const aIds = (assocs || []).map((a) => a.id);
  let aDel = 0;
  if (aIds.length) { const { error } = await supabase.from('associations').delete().in('id', aIds); if (error) console.error('associations delete error:', error.message); else aDel = aIds.length; }
  console.log(`🧹 Cleaned: ${rDel} seeded report(s), ${aDel} demo association(s) removed.`);
  console.log('App is now in honest empty state. Re-seed for a demo with: node seed/seed-data.js && node seed/seed-associations.js');
})().catch((e) => { console.error('CLEANUP ERROR:', e.message); process.exit(1); });
