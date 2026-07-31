const { createClient } = require('@supabase/supabase-js');
const WS = require('ws');
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(URL, KEY, { realtime: { transport: WS } });
async function run() {
  const { data, error } = await supabase.from('profiles').select('streak_cur').limit(1);
  console.log("streak_cur exists:", !error);
  if(error) console.log(error.message);
}
run();
