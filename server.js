import express from 'express';
import pg from 'pg';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'demo',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/var/images';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(UPLOAD_DIR));

// Providers API
app.get('/api/providers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM providers ORDER BY provider_id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/providers', async (req, res) => {
  const { provider_id, provider_name, provider_city } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO providers (provider_id, provider_name, provider_city) VALUES ($1, $2, $3) RETURNING *',
      [provider_id, provider_name, provider_city]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/providers/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM providers WHERE provider_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Images API
app.get('/api/images', (req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR)
      .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
      .map(f => {
        const stats = fs.statSync(path.join(UPLOAD_DIR, f));
        return { name: f, size: stats.size, uploaded: stats.mtime, url: `/uploads/${f}` };
      })
      .sort((a, b) => b.uploaded - a.uploaded);
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/images', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ name: req.file.filename, size: req.file.size, url: `/uploads/${req.file.filename}` });
});

app.delete('/api/images/:name', (req, res) => {
  try {
    fs.unlinkSync(path.join(UPLOAD_DIR, req.params.name));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Upload directory: ${UPLOAD_DIR}`);
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Database connected:', result.rows[0]);
  } catch (err) {
    console.error('Database connection failed:', err.message);
  }
});
