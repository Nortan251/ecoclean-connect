/* seed/seed-data.js — populate the demo with believable Agadir reports + photos.
 * Run: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node seed/seed-data.js
 * Uses the SERVICE ROLE key (bypasses RLS) to insert directly + upload to storage,
 * so it can set realistic created_at / verified_at / reporter_name (the HTTP API
 * can't backdate or forge names). Idempotent: if seeded reports already exist
 * (description contains the SEED_TAG) it skips — re-running won't duplicate.
 * Photos are generated offline by ./_jpeg.js (no native canvas needed) and uploaded
 * to the public 'ecoclean' bucket under seed/. Verified reports get before+after. */
'use strict';
const { createClient } = require('@supabase/supabase-js');
const { encode } = require('./_jpeg');

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first.'); process.exit(1); }
const supabase = createClient(URL, KEY);
const BUCKET = 'ecoclean';
const SEED_TAG = '[seed]';
const W = 80, H = 60;

const CATS = ['illegal_dumping', 'water', 'air_smoke', 'plastic_marine', 'other'];
const HUE = { illegal_dumping: 30, water: 205, air_smoke: 0, plastic_marine: 190, other: 95 };
const SPOTS = [
  ['Marina d’Agadir', 30.4142, -9.6045], ['Anza beach', 30.4520, -9.6260], ['Talborjt market', 30.4210, -9.5970],
  ['Hay Mohammadi', 30.4080, -9.5620], ['Dakhla avenue', 30.4260, -9.5880], ['Taghazout road', 30.4700, -9.7100],
  ['Souk El Had edge', 30.4190, -9.5760], ['Agadir Oufella foot', 30.4330, -9.5990], ['Ben Sergao', 30.3980, -9.5400],
  ['Tiligwech', 30.4050, -9.5750],
];
const NAMES = ['Youssef A.', 'Fatima Z.', 'Mehdi B.', 'Amina L.', 'Karim T.', 'Salma R.', 'Omar H.', 'Nadia K.', 'Rachid M.', 'Hind E.', 'Amine S.', 'Khadija B.'];
const DESC = {
  illegal_dumping: ['Construction rubble dumped in the vacant lot, growing every week.', 'Household bags left beside the bins for days, animals tearing them open.', 'An illegal dump of tires and plastic behind the shops.'],
  water: ['Brown, foul-smelling water running into the gutter from a broken pipe.', 'Stagnant water collecting trash near the drain, breeding mosquitoes.', 'A leaking sewer line flooding the sidewalk.'],
  air_smoke: ['Someone burning plastic and waste in the open, thick black smoke.', 'Constant smoke from an uncontrolled fire near the houses.', 'Burning of cuttings and rubbish, smoke drifting into the street.'],
  plastic_marine: ['Plastic bottles and bags piled along the shoreline after the tide.', 'Fishing nets and plastic washed up, tangled in the rocks.', 'A stretch of beach covered in single-use plastic.'],
  other: ['Oil spill on the road from a leaking vehicle, slippery and unmarked.', 'Abandoned appliance dumped on the pavement, blocking the way.', 'Graffiti and broken glass making the corner unsafe at night.'],
};

function hsl(h, s, l) {
  s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}
function rnd(seed) { let x = Math.sin(seed * 999.13) * 43758.5453; return x - Math.floor(x); }

// A simple, distinct placeholder photo: tinted gradient + a marker shape + noise.
function makeImage(cat, kind, seed) {
  const base = kind === 'after' ? hsl(140, 45, 52) : hsl(HUE[cat], kind === 'before' ? 35 : 20, kind === 'before' ? 32 : 40);
  const rgb = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = (y * W + x) * 3;
    const grad = 0.7 + 0.3 * (y / H);
    const n = (rnd(seed + x * 7.1 + y * 13.3) - 0.5) * 26;
    let r = base[0] * grad + n, g = base[1] * grad + n, b = base[2] * grad + n;
    // marker: a bright circle (after) or a dark blotch (before) off-center
    const cx = 18 + (seed % 5) * 11, cy = 16 + (seed % 4) * 9, d = Math.hypot(x - cx, y - cy);
    if (kind === 'after' && d < 9) { r = 235; g = 245; b = 235; }       // clean patch
    else if (kind === 'before' && d < 11) { r *= 0.4; g *= 0.4; b *= 0.35; } // dark mess
    rgb[p] = Math.max(0, Math.min(255, r)); rgb[p + 1] = Math.max(0, Math.min(255, g)); rgb[p + 2] = Math.max(0, Math.min(255, b));
  }
  return encode(rgb, W, H);
}

async function upload(cat, kind, seed) {
  const buf = makeImage(cat, kind, seed);
  const path = `seed/${kind}-${cat}-${seed}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error('upload failed: ' + error.message);
  return `${URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Idempotency guard.
  const { data: existing } = await supabase.from('reports').select('id').ilike('description', '%' + SEED_TAG + '%').limit(1);
  if (existing && existing.length) { console.log('Seed already present (' + existing.length + '+ tagged reports). Delete them first to re-seed. Exiting.'); return; }

  const N = 40, rows = [];
  const now = Date.now();
  for (let i = 0; i < N; i++) {
    const cat = CATS[i % CATS.length];
    const spot = SPOTS[i % SPOTS.length];
    const verified = i % 2 === 0;                 // ~half verified
    const lat = spot[1] + (rnd(i + 1) - 0.5) * 0.012;
    const lng = spot[2] + (rnd(i + 2) - 0.5) * 0.012;
    const createdAt = new Date(now - (i * 11 + 3) * 3600 * 1000 - Math.floor(rnd(i + 3) * 3600 * 1000)).toISOString();
    const reporter_name = rnd(i + 4) > 0.3 ? NAMES[i % NAMES.length] : 'Anonymous';
    process.stdout.write(`  [${i + 1}/${N}] ${cat} @ ${spot[0]} (${verified ? 'verified' : 'reported'})…`);
    const before = await upload(cat, 'before', i + 100);
    let after = null, verifiedAt = null, rewardCode = null, rewardIssued = false;
    if (verified) {
      after = await upload(cat, 'after', i + 100);
      verifiedAt = new Date(new Date(createdAt).getTime() + (1 + Math.floor(rnd(i + 5) * 3)) * 86400000).toISOString();
      rewardCode = 'ECO-' + (1000 + i);
      rewardIssued = true;
    }
    rows.push({
      reporter_name, category: cat, description: DESC[cat][i % 3] + ' ' + SEED_TAG,
      lat, lng, before_photo: before, after_photo: after,
      status: verified ? 'verified' : 'reported', verified_at: verifiedAt,
      reward_code: rewardCode, reward_issued: rewardIssued, created_at: createdAt, reporter_user_id: null,
    });
    console.log(' ok');
    await sleep(120); // gentle on storage rate limits
  }

  const { error } = await supabase.from('reports').insert(rows);
  if (error) { console.error('INSERT failed:', error.message); process.exit(1); }
  console.log(`\n✅ Seeded ${rows.length} reports (${rows.filter((r) => r.status === 'verified').length} verified with before/after).`);
  console.log('Open /impact.html and the dashboard — counters, gallery and map should now be alive.');
}

main().catch((e) => { console.error('SEED ERROR:', e.message); process.exit(1); });
