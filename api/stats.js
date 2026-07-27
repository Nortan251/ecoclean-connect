const { supabase } = require('./_lib/supabase');
const { friendlyDbError } = require('./_lib/helpers');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();

  const { data, error } = await supabase.from('reports').select('status, category, reporter_name');
  if (error) return res.status(500).json({ error: friendlyDbError(error.message) });

  const byCategory = {
    illegal_dumping: 0,
    water: 0,
    air_smoke: 0,
    plastic_marine: 0,
    other: 0,
  };
  // Estimated waste removed per VERIFIED clean-up, by category (kg). This is a
  // transparent MODEL, not a measured weight — we have no scale in the field, so
  // we publish a stated per-category assumption (the same honest-modelling approach
  // civic dashboards like civic-tech impact reports use; the methodology is shown on
  // the Impact page). Tuned to be conservative/plausible for a Moroccan clean-up.
  const KG_PER_VERIFIED = { illegal_dumping: 35, plastic_marine: 18, water: 10, air_smoke: 0, other: 12 };
  let reported = 0;
  let verified = 0;
  let kgRemoved = 0;
  const citizens = new Set();
  (data || []).forEach((r) => {
    if (byCategory[r.category] !== undefined) byCategory[r.category]++;
    if (r.status === 'verified') { verified++; kgRemoved += KG_PER_VERIFIED[r.category] || 0; }
    else reported++;
    const nm = (r.reporter_name || '').trim();
    if (nm && nm.toLowerCase() !== 'anonymous') citizens.add(nm.toLowerCase());
  });

  // Public partner roster for the /associations "network" page. Folded into /api/stats
  // (NOT a new endpoint) so we stay at the 12-function Hobby cap. Only non-sensitive
  // org fields; per-city counts are computed client-side from /api/reports.
  let associations = [];
  try { const ar = await supabase.from('associations').select('name, city, lat, lng, radius_km, contact_email').order('city'); associations = ar.data || []; } catch (e) {}

  return res
    .status(200)
    .json({
      total: (data || []).length, reported, verified, byCategory,
      kgRemoved, citizens: citizens.size, associations,
      kgMethod: 'estimated kg per verified clean-up by category (illegal_dumping 35, plastic_marine 18, water 10, other 12, air_smoke 0)',
    });
};
