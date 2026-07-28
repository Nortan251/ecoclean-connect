const { supabase } = require('./_lib/supabase');
const { requireAdminContext } = require('./_lib/helpers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  
  // Only Super Admins can generate demo data
  const ac = await requireAdminContext(req, res);
  if (!ac.ok || ac.kind !== 'super') {
    if (ac.ok) return res.status(403).json({ error: 'only super admins can generate demo data' });
    return;
  }

  // Realistic cluster centers in Agadir, Morocco
  const centers = [
    { lat: 30.4142, lng: -9.6045, cat: 'illegal_dumping' }, // Marina area
    { lat: 30.4520, lng: -9.6260, cat: 'plastic_marine' },  // Anza beach area
    { lat: 30.4210, lng: -9.5970, cat: 'water' },           // Talborjt market
    { lat: 30.3980, lng: -9.5400, cat: 'other' }            // Ben Sergao
  ];

  const reports = [];
  const now = Date.now();

  for (let i = 0; i < 45; i++) {
    const c = centers[i % centers.length];
    
    // Add realistic mathematical clustering (random scatter within ~800 meters)
    const rLat = c.lat + (Math.random() - 0.5) * 0.008;
    const rLng = c.lng + (Math.random() - 0.5) * 0.008;
    
    // Backdate the reports over the last 14 days so Analytics charts look great
    const pastDate = new Date(now - Math.random() * 14 * 86400000).toISOString();
    const isVerified = Math.random() > 0.4; // 60% chance of being verified

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
};
