const { supabase } = require('./_lib/supabase');

// Public WEEKLY leaderboard — "who is moving the needle THIS week".
// Complements the all-time /api/leaderboard (which ranks by stored points) with a
// freshness signal: raw report volume over the last 7 days. This drives the
// retention / competition loop on the dashboard without needing a schema change,
// because we aggregate straight off the reports table (server-side, tamper-proof)
// and join display names from profiles. No auth required; never returns emails.
//
// Grouping happens in JS (not SQL) on purpose: it keeps the query a simple,
// index-friendly range scan on created_at (reports_reporter_idx + a timestamptz
// filter) and avoids depending on whether the project's Postgres exposes the
// exact aggregation syntax we want. At this scale (hundreds of rows/week) the
// in-memory group-by is trivially cheap.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('reports')
    .select('reporter_user_id')
    .not('reporter_user_id', 'is', null)
    .gte('created_at', since);
  if (error) return res.status(500).json({ error: error.message });

  const counts = new Map(); // uid -> count
  (data || []).forEach((r) => {
    if (!r.reporter_user_id) return;
    counts.set(r.reporter_user_id, (counts.get(r.reporter_user_id) || 0) + 1);
  });
  if (!counts.size) return res.status(200).json([]);

  const ids = Array.from(counts.keys());
  const { data: prof, error: perr } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', ids);
  if (perr) return res.status(500).json({ error: perr.message });
  const nameOf = new Map((prof || []).map((p) => [p.id, p.display_name]));

  const board = ids
    .map((uid) => ({ name: nameOf.get(uid) || 'Anonymous', reports: counts.get(uid), uid }))
    .sort((a, b) => b.reports - a.reports)
    .slice(0, 10);
  return res.status(200).json(board);
};
