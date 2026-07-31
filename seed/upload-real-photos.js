const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first.');
  process.exit(1);
}

let WS; try { WS = require('ws'); } catch (e) { WS = undefined; }
const supabase = createClient(URL, KEY, WS ? { realtime: { transport: WS } } : undefined);

async function uploadFile(path, name) {
  const content = fs.readFileSync(path);
  const { data, error } = await supabase.storage
    .from('ecoclean')
    .upload('gallery/' + name, content, {
      contentType: 'image/jpeg',
      upsert: true
    });
  if (error) {
    console.error('Failed to upload', name, error);
    return null;
  }
  return `${URL}/storage/v1/object/public/ecoclean/gallery/${name}`;
}

async function run() {
  const urls = [];
  for (let i = 1; i <= 5; i++) {
    const url = await uploadFile(`image-search/street-clean-up-before-after-${i}.jpg`, `real-${i}.jpg`);
    if (url) urls.push(url);
  }
  console.log("Uploaded URLs:", urls);
  
  // Now, update a few verified reports in the DB to use these images as 'afterPhoto' and another one as 'beforePhoto'.
  const { data: reports } = await supabase.from('reports').select('id').eq('status', 'verified').limit(5);
  
  if (reports && reports.length > 0) {
    for (let i = 0; i < reports.length; i++) {
      const beforeUrl = urls[i % urls.length];
      const afterUrl = urls[(i + 1) % urls.length]; // Just shifting it for demo
      await supabase.from('reports').update({
        before_photo: beforeUrl,
        after_photo: afterUrl
      }).eq('id', reports[i].id);
    }
    console.log(`Updated ${reports.length} verified reports with real photos!`);
  }
}
run();
