const { supabase } = require('./_lib/supabase');
const { REPORT_SELECT, readJson, uploadPhoto, friendlyDbError } = require('./_lib/helpers');
const { verifyUser } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('reports')
      .select(REPORT_SELECT)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: friendlyDbError(error.message) });
    return res.status(200).json(data || []);
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = await readJson(req);
    } catch (e) {
      return res.status(400).json({ error: 'invalid json' });
    }
    if (!body.photo || !body.lat || !body.lng) {
      return res.status(400).json({ error: 'photo and location required' });
    }
    // If the reporter is signed in, attribute the report to them (server-verified
    // from the access token — never trust a client-supplied id). Anonymous stays null.
    const user = await verifyUser(req);
    try {
      const before = await uploadPhoto(body.photo);
      const { data, error } = await supabase
        .from('reports')
        .insert({
          reporter_name: body.reporterName || 'Anonymous',
          category: body.category || 'other',
          description: body.description || '',
          lat: parseFloat(body.lat),
          lng: parseFloat(body.lng),
          before_photo: before,
          status: 'reported',
          reporter_user_id: user ? user.id : null,
        })
        .select(REPORT_SELECT)
        .single();
      if (error) return res.status(500).json({ error: friendlyDbError(error.message) });
      // Server-side streak v2: an accepted report = an active day. Advance the
      // reporter's streak (idempotent per day). Fire-and-forget + guarded so a
      // missing RPC (migration not yet run) never breaks report creation.
      if (user && user.id) {
        supabase.rpc('record_daily_activity', { uid: user.id }).catch(() => {});
      }
      return res.status(201).json(data);
    } catch (e) {
      return res.status(500).json({ error: friendlyDbError(e && e.message ? e.message : String(e)) });
    }
  }

  res.status(405).end();
};
