const { supabase } = require('./_lib/supabase');
const { friendlyDbError, requireAdminContext } = require('./_lib/helpers');

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    // Only Super Admins can generate demo data
    const ac = await requireAdminContext(req, res);
    if (!ac.ok || ac.kind !== 'super') {
      if (ac.ok) return res.status(403).json({ error: 'only super admins can generate demo data' });
      return;
    }

    const centers = [
      { lat: 30.4142, lng: -9.6045, cat: 'illegal_dumping' },
      { lat: 30.4520, lng: -9.6260, cat: 'plastic_marine' }, 
      { lat: 30.4210, lng: -9.5970, cat: 'water' },          
      { lat: 30.3980, lng: -9.5400, cat: 'other' }           
    ];

    const reports = [];
    const now = Date.now();

    for (let i = 0; i < 45; i++) {
      const c = centers[i % centers.length];
      const rLat = c.lat + (Math.random() - 0.5) * 0.008;
      const rLng = c.lng + (Math.random() - 0.5) * 0.008;
      const pastDate = new Date(now - Math.random() * 14 * 86400000).toISOString();
      const isVerified = Math.random() > 0.4;

      reports.push({
        reporter_name: 'Demo Citizen ' + Math.floor(Math.random() * 100),
        category: c.cat,
        description: 'Demo simulated report for portfolio presentation.',
        lat: rLat,
        lng: rLng,
        status: isVerified ? 'verified' : 'reported',
        created_at: pastDate,
        verified_at: isVerified ? new Date(new Date(pastDate).getTime() + (Math.random() * 86400000)).toISOString() : null
      });
    }

    const { error } = await supabase.from('reports').insert(reports);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ ok: true, count: 45 });
  }

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
  const KG_PER_VERIFIED = { illegal_dumping: 35, plastic_marine: 18, water: 10, air_smoke: 0, other: 12 };
  let reported = 0;
  let verified = 0;
  let kgRemoved = 0;
  const citizens = new Set();
  (data || []).forEach((r) => {
    if (r.status === 'rejected') return;
    if (byCategory[r.category] !== undefined) byCategory[r.category]++;
    if (r.status === 'verified') { verified++; kgRemoved += KG_PER_VERIFIED[r.category] || 0; }
    else if (r.status === 'reported') reported++;
    const nm = (r.reporter_name || '').trim();
    if (nm && nm.toLowerCase() !== 'anonymous') citizens.add(nm.toLowerCase());
  });

  let associations = [];
  try { const ar = await supabase.from('associations').select('name, city, lat, lng, radius_km, contact_email').order('city'); associations = ar.data || []; } catch (e) {}

  return res.status(200).json({
    total: (data || []).length, reported, verified, byCategory,
    kgRemoved, citizens: citizens.size, associations,
    kgMethod: 'estimated kg per verified clean-up by category (illegal_dumping 35, plastic_marine 18, water 10, other 12, air_smoke 0)',
  });
};
