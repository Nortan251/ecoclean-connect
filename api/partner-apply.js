const { supabase } = require('./_lib/supabase');

// POST /api/partner-apply — store a partner application from the public form.
// No auth required (the form is public); RLS allows anon INSERT but never anon
// SELECT, so submissions are write-only from the browser and read only by the
// service role (a future admin leads view). Basic server-side validation + light
// sanitisation (defence in depth; the data is never rendered as HTML).
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  let body;
  try { body = JSON.parse(req.body || '{}'); } catch (e) { return res.status(400).json({ error: 'invalid json' }); }
  const clean = (s) => String(s == null ? '' : s).replace(/[<>]/g, '').trim();
  const org_name = clean(body.orgName), city = clean(body.city), email = clean(body.email);
  if (!org_name || !city || !email) return res.status(400).json({ error: 'org, city and email are required' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'invalid email' });
  const row = {
    org_name, city, email,
    contact_name: clean(body.contactName) || null,
    org_type: clean(body.orgType) || null,
    message: clean(body.message).slice(0, 2000) || null,
  };
  const { error } = await supabase.from('partner_applications').insert(row);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ ok: true });
};
