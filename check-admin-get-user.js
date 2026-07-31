const { createClient } = require('@supabase/supabase-js');
const WS = require('ws');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: WS } });
async function run() {
  const { data: { user }, error } = await supabase.auth.admin.getUserById('17209f5c-2d4b-4e0d-a20b-a6a829002bf4');
  console.log(user ? user.email : error);
}
run();
