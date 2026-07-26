const { supabase } = require('./supabase');

// Verify a Bearer access token (sent by the browser Supabase client) using the
// service-role client, and return the auth user (or null). This is what lets the
// server TRUST the caller's identity — the client never sends a spoofable user_id.
async function verifyUser(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  try {
    const { data, error } = await supabase.auth.getUser(m[1]);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch (e) {
    return null;
  }
}

module.exports = { verifyUser };
