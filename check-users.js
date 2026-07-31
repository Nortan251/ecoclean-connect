const { createClient } = require('@supabase/supabase-js');
const WS = require('ws');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: WS } });
async function run() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  console.log("users:", users ? users.length : error);
  if(users) {
    const ids = users.map(u => u.id);
    console.log(ids);
  }
}
run();
