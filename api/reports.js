const { supabase } = require('./_lib/supabase');
const { REPORT_SELECT, readJson, uploadPhoto } = require('./_lib/helpers');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('reports')
      .select(REPORT_SELECT)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
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
        })
        .select(REPORT_SELECT)
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    } catch (e) {
      return res.status(500).json({ error: String(e) });
    }
  }

  res.status(405).end();
};
