/* /api/health — read-only connection diagnostic.
 * Visiting https://<your-site>/api/health returns a JSON report of exactly what
 * is (and isn't) wired up: env vars present? reports table reachable? alerts
 * table reachable? storage bucket present + public? This turns "the app says
 * no table or something" into a precise, shareable diagnosis. It only READS
 * (select limit 1 / getBucket) so it is safe to hit any time. */
const { supabase } = require('./_lib/supabase');
const { BUCKET, readJson } = require('./_lib/helpers');

async function tableCheck(name) {
  try {
    const { error } = await supabase.from(name).select('id').limit(1);
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

module.exports = async (req, res) => {
  // POST /api/health doubles as the PUBLIC partner-application funnel. We piggyback
  // here (instead of a dedicated file) because the Vercel Hobby plan caps us at 12
  // serverless functions and we are exactly at 12 — a 13th file makes Vercel REJECT
  // the whole deployment (a silent "Deployment has failed" with no code error). A
  // public, write-only application is operationally a "service" action, so it lives
  // on the service endpoint. RLS allows anon INSERT but never anon SELECT on the
  // partner_applications table, so submissions are private. GET (below) is unchanged.
  if (req.method === 'POST') {
    // Vercel may hand us the body already parsed (object), as a string, or as a raw
    // stream — handle all three so the funnel works regardless of body-parsing mode.
    let body;
    try {
      if (req.body && typeof req.body === 'object') body = req.body;
      else if (typeof req.body === 'string') body = JSON.parse(req.body || '{}');
      else body = await readJson(req);
    } catch (e) { return res.status(400).json({ error: 'invalid json' }); }
    const clean = (s) => String(s == null ? '' : s).replace(/[<>]/g, '').trim();
    const org_name = clean(body.orgName), city = clean(body.city), email = clean(body.email);
    if (!org_name || !city || !email) return res.status(400).json({ error: 'org, city and email are required' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'invalid email' });
    const row = {
      org_name, city, email,
      contact_name: clean(body.contactName) || null,
      org_type: clean(body.orgType) || null,
      message: clean(body.message).slice(0, 2000) || null,
    };
    const { error } = await supabase.from('partner_applications').insert(row);
    if (error) {
      // Table not created yet (accounts_part6.sql not run) -> degrade gracefully so the
      // public form never shows a raw 500; the client maps 503 to "opening soon".
      if (/schema cache|does not exist|42P01|PGRST204|PGRST205/i.test(error.message || '')) {
        return res.status(503).json({ error: 'applications opening soon' });
      }
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json({ ok: true });
  }
  if (req.method !== 'GET') return res.status(405).end();
  const env = {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const reports = await tableCheck('reports');
  const alerts = await tableCheck('alerts');

  let storageBucket = { ok: false };
  try {
    const { data, error } = await supabase.storage.getBucket(BUCKET);
    storageBucket = error || !data
      ? { ok: false, error: (error && error.message) || 'missing' }
      : { ok: true, public: !!data.public };
  } catch (e) {
    storageBucket = { ok: false, error: String((e && e.message) || e) };
  }

  const ok = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && reports.ok && alerts.ok && storageBucket.ok;

  res.status(200).json({
    ok,
    env,
    tables: { reports, alerts },
    storageBucket,
    hint: ok
      ? 'All connected. Reporting, dashboard and admin should work.'
      : 'Setup incomplete. (1) In Supabase -> SQL Editor, run the whole contents of supabase/schema.sql (it creates the reports + alerts tables AND a public bucket named ecoclean). (2) In Vercel -> Settings -> Environment Variables, set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the SERVICE ROLE key from Supabase -> Settings -> API, NOT the anon key), then redeploy.',
  });
};
