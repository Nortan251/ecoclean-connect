/* /api/config — public bootstrap for the browser Supabase (Realtime) client.
 * Returns ONLY public-safe values: the project URL and the ANON key. The anon
 * key is PUBLIC BY DESIGN — what keeps it safe is Row-Level Security on the
 * tables (see supabase/realtime-rls.sql), which limits the anon role to READ.
 * The secret service-role key is NEVER returned here. Serving these from env
 * (instead of hard-coding them in the static bundle) means they live in one
 * place and can be rotated without a code change. */
module.exports = async (req, res) => {
  res.status(200).json({
    url: process.env.SUPABASE_URL || null,
    anonKey: process.env.SUPABASE_ANON_KEY || null,
  });
};
