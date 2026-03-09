import express from 'express';
import pg from 'pg';

const app = express();
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'providers_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

app.use(express.json());
app.use(express.static('public'));

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
  console.log('POST /api/providers:', { provider_id, provider_name, provider_city });
  try {
    const result = await pool.query(
      'INSERT INTO providers (provider_id, provider_name, provider_city) VALUES ($1, $2, $3) RETURNING *',
      [provider_id, provider_name, provider_city]
    );
    console.log('Insert successful:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Insert failed:', err);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Database connected:', result.rows[0]);
  } catch (err) {
    console.error('Database connection failed:', err.message);
  }
});
