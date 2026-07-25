const { createClient } = require('@supabase/supabase-js');

// Node 20 has no global WebSocket; supabase-js realtime needs one. On Node 22+
// this is already defined, so we only shim when missing.
try {
  const ws = require('ws');
  if (typeof global.WebSocket === 'undefined') global.WebSocket = ws.WebSocket || ws;
} catch (e) {}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

module.exports = { supabase };
