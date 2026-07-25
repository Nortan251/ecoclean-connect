/* /api/health — read-only connection diagnostic.
 * Visiting https://<your-site>/api/health returns a JSON report of exactly what
 * is (and isn't) wired up: env vars present? reports table reachable? alerts
 * table reachable? storage bucket present + public? This turns "the app says
 * no table or something" into a precise, shareable diagnosis. It only READS
 * (select limit 1 / getBucket) so it is safe to hit any time. */
const { supabase } = require('./_lib/supabase');
const { BUCKET } = require('./_lib/helpers');

async function tableCheck(name) {
  try {
    const { error } = await supabase.from(name).select('id').limit(1);
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

module.exports = async (req, res) => {
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
