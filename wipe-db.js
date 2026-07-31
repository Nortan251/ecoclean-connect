const { createClient } = require('@supabase/supabase-js');
const WS = require('ws');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: WS } });

async function run() {
  console.log("Wiping all reports...");
  const { data: reports } = await supabase.from('reports').select('id');
  if (reports && reports.length > 0) {
    const ids = reports.map(r => r.id);
    await supabase.from('reports').delete().in('id', ids);
    console.log(`Deleted ${ids.length} reports.`);
  }

  console.log("Wiping all profiles/points (except admin roles)...");
  // We can't easily wipe auth.users, but we can reset all points and streaks to 0
  const { error } = await supabase.from('profiles').update({ 
    points: 0, 
    streak_cur: 0, 
    streak_best: 0, 
    streak_last: null,
    claimed_quests: [] 
  }).neq('id', '00000000-0000-0000-0000-000000000000'); // match all
  
  if (error) console.log("Error resetting profiles:", error);
  else console.log("Reset all profiles to 0 points/streaks.");

  console.log("Wiping all storage images...");
  const { data: files } = await supabase.storage.from('ecoclean').list('reports');
  if (files && files.length > 0) {
    const paths = files.map(f => 'reports/' + f.name);
    await supabase.storage.from('ecoclean').remove(paths);
    console.log(`Deleted ${paths.length} images from reports folder.`);
  }
}
run();
