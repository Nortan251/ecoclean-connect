const { supabase } = require('./_lib/supabase');
const { ALERT_SELECT, readJson, requireAdmin, friendlyDbError } = require('./_lib/helpers');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('alerts')
      .select(ALERT_SELECT)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: friendlyDbError(error.message) });
    return res.status(200).json(data || []);
  }

  if (req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    let body;
    try {
      body = await readJson(req);
    } catch (e) {
      return res.status(400).json({ error: 'invalid json' });
    }
    if (!body.title) return res.status(400).json({ error: 'title required' });
    const { data, error } = await supabase
      .from('alerts')
      .insert({ title: body.title, body: body.body || '' })
      .select(ALERT_SELECT)
      .single();
    if (error) return res.status(500).json({ error: friendlyDbError(error.message) });
    return res.status(201).json(data);
  }

  res.status(405).end();
};
