const { supabase } = require('./_lib/supabase');

// /api/leaderboard — ONE function, two boards (keeps us under Vercel Hobby's
// 12-function cap; the weekly board used to be its own file).
//   ?range=week  -> this week's movers, ranked by raw report count (server
//                   aggregated off the reports table; tamper-proof; resets the
//                   race weekly so newcomers can win).
//   default      -> all-time "Top citizens", ranked by stored points.
// Public, no auth, never returns emails. The weekly group-by is done in JS over
// an index-friendly range scan (cheap at this scale) instead of SQL aggregation.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();

  if ((req.query.range || '') === 'week') {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from('reports')
      .select('reporter_user_id')
      .not('reporter_user_id', 'is', null)
      .gte('created_at', since);
    if (error) return res.status(500).json({ error: error.message });
    const counts = new Map();
    (data || []).forEach((r) => { if (r.reporter_user_id) counts.set(r.reporter_user_id, (counts.get(r.reporter_user_id) || 0) + 1); });
    if (!counts.size) return res.status(200).json([]);
    const ids = Array.from(counts.keys());
    const { data: prof, error: perr } = await supabase.from('profiles').select('id, display_name').in('id', ids);
    if (perr) return res.status(500).json({ error: perr.message });
    const nameOf = new Map((prof || []).map((p) => [p.id, p.display_name]));
    const board = ids
      .map((uid) => ({ name: nameOf.get(uid) || 'Anonymous', reports: counts.get(uid), uid }))
      .sort((a, b) => b.reports - a.reports)
      .slice(0, 10);
    return res.status(200).json(board);
  }

  // all-time
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, points')
    .gt('points', 0)
    .order('points', { ascending: false })
    .limit(10);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data || []);
};
