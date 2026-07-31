const { createClient } = require('@supabase/supabase-js');
const WS = require('ws');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: WS } });

async function run() {
  const email = 'maelmoussaoui18@gmail.com';
  console.log(`Looking up user by email: ${email}...`);
  
  // Get users
  const { data: { users }, error: authErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authErr || !users) {
    console.error("Auth error:", authErr);
    return;
  }
  
  const user = users.find(u => u.email === email);
  if (!user) {
    console.error(`User ${email} not found in Supabase Auth.`);
    return;
  }
  
  console.log(`Found user ${user.id}. Ensuring profile exists...`);
  
  // Upsert profile just in case it doesn't exist
  await supabase.from('profiles').upsert(
    { id: user.id, display_name: 'Mael (Super Admin)' }, 
    { onConflict: 'id', ignoreDuplicates: true }
  );
  
  console.log(`Setting role to 'super'...`);
  const { data, error } = await supabase.from('profiles').update({ role: 'super' }).eq('id', user.id);
  
  if (error) {
    console.error("Error updating profile:", error.message);
  } else {
    console.log(`Success! ${email} is now a super admin.`);
  }
}
run();
