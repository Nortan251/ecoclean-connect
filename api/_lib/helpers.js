const { supabase } = require('./supabase');

const BUCKET = 'ecoclean';

const REPORT_SELECT =
  'id, reporter_name as reporterName, category, description, lat, lng, before_photo as beforePhoto, after_photo as afterPhoto, status, verification_notes as verificationNotes, reward_code as rewardCode, reward_issued as rewardIssued, created_at as createdAt, verified_at as verifiedAt';

const ALERT_SELECT = 'id, title, body, created_at as createdAt';

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

async function uploadPhoto(dataUrl) {
  const [meta, b64] = (dataUrl || '').split(',');
  if (!b64) return null;
  const m = meta.match(/data:(.*?);base64/);
  const contentType = m ? m[1] : 'image/jpeg';
  const buffer = Buffer.from(b64, 'base64');
  const path = `reports/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true });
  if (error) throw error;
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

function requireAdmin(req, res) {
  const key = req.headers['x-admin-key'];
  if (key !== (process.env.ADMIN_KEY || 'ecoclean-admin')) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

module.exports = { BUCKET, REPORT_SELECT, ALERT_SELECT, readJson, uploadPhoto, requireAdmin };
