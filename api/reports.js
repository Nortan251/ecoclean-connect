const { supabase } = require('./_lib/supabase');
const { REPORT_SELECT, readJson, uploadPhoto, friendlyDbError, adminContextOrNull, inCityBounds } = require('./_lib/helpers');
const { verifyUser } = require('./_lib/auth');
const push = require('./_lib/push');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const ac = await adminContextOrNull(req, res);
    if (ac && !ac.ok) return; 
    let q = supabase.from('reports').select(REPORT_SELECT).neq('status', 'rejected').order('created_at', { ascending: false });
    if (ac && ac.kind === 'assoc' && ac.ctx) {
      const c = ac.ctx, dLat = c.radius_km / 111.0, dLng = c.radius_km / Math.max(1, 111.0 * Math.cos(c.lat * Math.PI / 180));
      q = q.gte('lat', c.lat - dLat).lte('lat', c.lat + dLat).gte('lng', c.lng - dLng).lte('lng', c.lng + dLng);
    }
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: friendlyDbError(error.message) });
    let list = data || [];
    if (ac && ac.kind === 'assoc' && ac.ctx) list = list.filter((r) => inCityBounds(r, ac.ctx));
    return res.status(200).json(list);
  }

  if (req.method === 'POST') {
    let body;
    try { body = await readJson(req); } catch (e) { return res.status(400).json({ error: 'invalid json' }); }
    
    if (!body.photo || !body.lat || !body.lng) {
      return res.status(400).json({ error: 'photo and location required' });
    }
    const isSelfCleaned = !!body.isSelfCleaned;
    if (isSelfCleaned && !body.afterPhoto) {
      return res.status(400).json({ error: 'after photo required for self-cleaned reports' });
    }

    const user = await verifyUser(req);
    try {
      const before = await uploadPhoto(body.photo);
      let after = null;
      if (isSelfCleaned) after = await uploadPhoto(body.afterPhoto);

      const status = isSelfCleaned ? 'verified' : 'reported';
      const verifiedAt = isSelfCleaned ? new Date().toISOString() : null;

      const { data, error } = await supabase
        .from('reports')
        .insert({
          reporter_name: body.reporterName || 'Anonymous',
          category: body.category || 'other',
          description: body.description || '',
          lat: parseFloat(body.lat),
          lng: parseFloat(body.lng),
          before_photo: before,
          after_photo: after,
          status: status,
          verified_at: verifiedAt,
          rewarded: isSelfCleaned,
          reporter_user_id: user ? user.id : null,
        })
        .select(REPORT_SELECT)
        .single();
      if (error) return res.status(500).json({ error: friendlyDbError(error.message) });
      
      const bgTasks = [];
      if (user && user.id) {
        bgTasks.push(supabase.rpc('record_daily_activity', { uid: user.id }).catch(() => {}));
        // Award points instantly if they self-cleaned it!
        if (isSelfCleaned) {
          bgTasks.push(supabase.rpc('award_points', { uid: user.id, amt: 20 }).catch(() => {}));
          bgTasks.push(supabase.rpc('apply_streak_bonus', { uid: user.id }).catch(() => {}));
        }
      }
      
      // Only ping admins if it requires verification (not self-cleaned)
      if (!isSelfCleaned) {
        bgTasks.push(push.toAdmins({
          title: 'New report 📍',
          body: 'A ' + (body.category || 'pollution') + ' report was just submitted and needs verification.',
          url: '/admin.html',
          icon: '/icon-192.png',
        }).catch(() => {}));
      }
      
      await Promise.allSettled(bgTasks);
      return res.status(201).json(data);
    } catch (e) {
      return res.status(500).json({ error: friendlyDbError(e && e.message ? e.message : String(e)) });
    }
  }
  res.status(405).end();
};
