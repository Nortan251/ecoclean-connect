const { supabase } = require('./_lib/supabase');
const { friendlyDbError } = require('./_lib/helpers');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();

  const { data, error } = await supabase.from('reports').select('status, category');
  if (error) return res.status(500).json({ error: friendlyDbError(error.message) });

  const byCategory = {
    illegal_dumping: 0,
    water: 0,
    air_smoke: 0,
    plastic_marine: 0,
    other: 0,
  };
  let reported = 0;
  let verified = 0;
  (data || []).forEach((r) => {
    if (byCategory[r.category] !== undefined) byCategory[r.category]++;
    if (r.status === 'verified') verified++;
    else reported++;
  });

  return res
    .status(200)
    .json({ total: (data || []).length, reported, verified, byCategory });
};
