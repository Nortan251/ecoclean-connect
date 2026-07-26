const { supabase } = require('./_lib/supabase');

// Public "Top citizens" leaderboard (server-computed from the tamper-proof
// server-side points). No auth required; never returns emails.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, points')
    .gt('points', 0)
    .order('points', { ascending: false })
    .limit(10);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data || []);
};
