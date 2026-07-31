const { createClient } = require('@supabase/supabase-js');
const WS = require('ws');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: WS } });
async function run() {
  const { data } = await supabase.from('reports').select('*').eq('status', 'verified');
  console.log('Verified reports:', data ? data.length : 0);
}
run();
