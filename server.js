/**
 * EcoClean Connect — MVP backend
 * -------------------------------------------------------------
 * A tiny, dependency-light server (Express + Multer) that:
 *   1. Serves the Progressive Web App (public/)
 *   2. Stores pollution reports + community alerts in JSON files
 *   3. Exposes a small REST API used by the app
 *
 * No native modules, no database server required → installs and
 * deploys anywhere (Render free tier, local laptop, etc.).
 *
 * NOTE: A JSON file store is perfect for an MVP / pilot. For real
 * scale you would swap it for Postgres/Supabase + object storage.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
// Simple shared-secret admin key. Set ADMIN_KEY in production!
const ADMIN_KEY = process.env.ADMIN_KEY || 'ecoclean-admin';

const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');
const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');

// --- make sure folders/files exist ---
for (const d of [DATA_DIR, UPLOAD_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}
function load(file, fallback) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}
function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let reports = load(REPORTS_FILE, []);
let alerts = load(ALERTS_FILE, []);

// --- file uploads (photos) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, crypto.randomBytes(12).toString('hex') + ext);
  },
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } }); // 8MB max

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

// Pollution categories (shared vocabulary between backend + frontend)
const CATEGORIES = {
  illegal_dumping: 'Illegal Dumping',
  water: 'Water Pollution',
  air_smoke: 'Air / Smoke',
  plastic_marine: 'Plastic / Marine',
  other: 'Other',
};

// -------------------------------------------------------------
// API
// -------------------------------------------------------------

// List all reports (newest first)
app.get('/api/reports', (req, res) => res.json(reports));

// Single report
app.get('/api/reports/:id', (req, res) => {
  const r = reports.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'not found' });
  res.json(r);
});

// Create a report (citizen submission)
// multipart fields: photo (required), lat, lng, category, description, reporterName
app.post('/api/reports', upload.single('photo'), (req, res) => {
  const { lat, lng, category, description, reporterName } = req.body;
  if (!req.file) return res.status(400).json({ error: 'photo required' });
  if (!lat || !lng) return res.status(400).json({ error: 'location required' });

  const report = {
    id: crypto.randomBytes(8).toString('hex'),
    reporterName: reporterName || 'Anonymous',
    category: CATEGORIES[category] ? category : 'other',
    description: description || '',
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    beforePhoto: '/uploads/' + req.file.filename,
    afterPhoto: null,
    status: 'reported', // red pin
    verificationNotes: '',
    rewardCode: null,
    rewardIssued: false,
    createdAt: new Date().toISOString(),
    verifiedAt: null,
  };
  reports.unshift(report);
  save(REPORTS_FILE, reports);
  res.status(201).json(report);
});

// Verify a cleanup (admin) → flips pin red -> green
// multipart: afterPhoto (optional), notes, rewardCode
app.post('/api/reports/:id/verify', upload.single('afterPhoto'), (req, res) => {
  if (req.get('x-admin-key') !== ADMIN_KEY)
    return res.status(401).json({ error: 'unauthorized' });
  const r = reports.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'not found' });

  if (req.file) r.afterPhoto = '/uploads/' + req.file.filename;
  r.status = 'verified'; // green pin
  r.verificationNotes = req.body.notes || '';
  r.verifiedAt = new Date().toISOString();
  if (req.body.rewardCode) {
    r.rewardCode = req.body.rewardCode;
    r.rewardIssued = true;
  }
  save(REPORTS_FILE, reports);
  res.json(r);
});

// Dashboard stats
app.get('/api/stats', (req, res) => {
  const byCategory = {};
  for (const c in CATEGORIES) byCategory[c] = 0;
  let reported = 0;
  let verified = 0;
  for (const r of reports) {
    byCategory[r.category] = (byCategory[r.category] || 0) + 1;
    if (r.status === 'verified') verified++;
    else reported++;
  }
  res.json({ total: reports.length, reported, verified, byCategory });
});

// Community alerts / announcements
app.get('/api/alerts', (req, res) => res.json(alerts));
app.post('/api/alerts', (req, res) => {
  if (req.get('x-admin-key') !== ADMIN_KEY)
    return res.status(401).json({ error: 'unauthorized' });
  const { title, body } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const alert = {
    id: crypto.randomBytes(6).toString('hex'),
    title,
    body: body || '',
    createdAt: new Date().toISOString(),
  };
  alerts.unshift(alert);
  save(ALERTS_FILE, alerts);
  res.status(201).json(alert);
});

app.listen(PORT, () =>
  console.log(`EcoClean Connect running on http://localhost:${PORT}`)
);
