const { createClient } = require('@supabase/supabase-js');
const WS = require('ws');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: WS } });

async function run() {
  console.log("Wiping all vouchers...");
  
  // Get all vouchers
  const { data: vouchers, error: getErr } = await supabase.from('vouchers').select('id');
  if (getErr) {
    console.error("Error fetching vouchers:", getErr);
    return;
  }
  
  if (vouchers && vouchers.length > 0) {
    const ids = vouchers.map(v => v.id);
    const { error: delErr } = await supabase.from('vouchers').delete().in('id', ids);
    if (delErr) {
      console.error("Error deleting vouchers:", delErr);
    } else {
      console.log(`Successfully deleted ${ids.length} vouchers.`);
    }
  } else {
    console.log("No vouchers found to delete. The database is already at 0 vouchers.");
  }
}

run();
