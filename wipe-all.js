const { createClient } = require('@supabase/supabase-js');
const WS = require('ws');
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(URL, KEY, { realtime: { transport: WS } });

async function wipe() {
  const { data: reports } = await supabase.from('reports').select('id');
  if (reports && reports.length > 0) {
    const ids = reports.map(r => r.id);
    await supabase.from('reports').delete().in('id', ids);
    console.log(`Deleted ${ids.length} reports.`);
  } else console.log('No reports.');

  const { data: files } = await supabase.storage.from('ecoclean').list('gallery');
  if (files && files.length > 0) {
    const filePaths = files.map(f => 'gallery/' + f.name);
    await supabase.storage.from('ecoclean').remove(filePaths);
    console.log(`Deleted ${files.length} images from gallery.`);
  } else console.log('No images.');
}
wipe();
