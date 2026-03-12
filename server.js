import express from 'express';
import pg from 'pg';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const { Pool } = pg;

// AWS Clients
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

// Get RDS credentials from Secrets Manager
async function getRDSCredentials() {
  try {
    const response = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_NAME })
    );
    return JSON.parse(response.SecretString);
  } catch (err) {
    console.error('Failed to get RDS credentials:', err);
    return {
      host: process.env.DB_HOST,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    };
  }
}

// Initialize database pool
let pool;
(async () => {
  const credentials = await getRDSCredentials();
  pool = new Pool({
    host: credentials.host,
    port: process.env.DB_PORT || 5432,
    database: 'demo',
    user: credentials.username,
    password: credentials.password,
    ssl: { rejectUnauthorized: false }
  });
})();

// Multer configurations
const s3Storage = multer.memoryStorage();
const efsStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, process.env.EFS_PATH || '/mnt/efs'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const uploadS3 = multer({ storage: s3Storage, limits: { fileSize: 10 * 1024 * 1024 } });
const uploadEFS = multer({ storage: efsStorage, limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static('public'));
app.use('/avatars', express.static(process.env.EFS_PATH || '/mnt/efs'));

// Metadata endpoint
app.get('/api/metadata', async (req, res) => {
  try {
    const tokenResponse = await fetch('http://169.254.169.254/latest/api/token', {
      method: 'PUT',
      headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' }
    });
    const token = await tokenResponse.text();

    const [regionResponse, instanceIdResponse] = await Promise.all([
      fetch('http://169.254.169.254/latest/meta-data/placement/region', {
        headers: { 'X-aws-ec2-metadata-token': token }
      }),
      fetch('http://169.254.169.254/latest/meta-data/instance-id', {
        headers: { 'X-aws-ec2-metadata-token': token }
      })
    ]);

    res.json({
      region: await regionResponse.text(),
      instanceId: await instanceIdResponse.text()
    });
  } catch (err) {
    res.json({ region: 'N/A', instanceId: 'N/A' });
  }
});

// CPU Stress endpoints
let stressInterval = null;
app.post('/api/stress', (req, res) => {
  const { duration = 60 } = req.body;
  if (stressInterval) return res.json({ status: 'already running' });

  const endTime = Date.now() + (duration * 1000);
  stressInterval = setInterval(() => {
    if (Date.now() >= endTime) {
      clearInterval(stressInterval);
      stressInterval = null;
      return;
    }
    for (let i = 0; i < 1000000; i++) Math.sqrt(Math.random());
  }, 0);

  res.json({ status: 'started', duration });
});

app.delete('/api/stress', (req, res) => {
  if (stressInterval) {
    clearInterval(stressInterval);
    stressInterval = null;
    res.json({ status: 'stopped' });
  } else {
    res.json({ status: 'not running' });
  }
});

// PRODUCT endpoints (RDS + S3)
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id');
    const products = await Promise.all(result.rows.map(async (p) => {
      if (p.image_url) {
        const url = await getSignedUrl(s3Client, new GetObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: p.image_url
        }), { expiresIn: 3600 });
        return { ...p, image_url: url };
      }
      return p;
    }));
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', uploadS3.single('image'), async (req, res) => {
  const { name, qty } = req.body;
  try {
    let imageKey = null;
    if (req.file) {
      imageKey = `products/${Date.now()}-${req.file.originalname}`;
      await s3Client.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: imageKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype
      }));
    }

    const result = await pool.query(
      'INSERT INTO products (name, qty, image_url) VALUES ($1, $2, $3) RETURNING *',
      [name, qty, imageKey]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', uploadS3.single('image'), async (req, res) => {
  const { name, qty } = req.body;
  try {
    let imageKey = null;
    if (req.file) {
      imageKey = `products/${Date.now()}-${req.file.originalname}`;
      await s3Client.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: imageKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype
      }));
    }

    const query = imageKey
      ? 'UPDATE products SET name = $1, qty = $2, image_url = $3 WHERE id = $4 RETURNING *'
      : 'UPDATE products SET name = $1, qty = $2 WHERE id = $3 RETURNING *';
    const params = imageKey ? [name, qty, imageKey, req.params.id] : [name, qty, req.params.id];

    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT image_url FROM products WHERE id = $1', [req.params.id]);
    if (result.rows[0]?.image_url) {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: result.rows[0].image_url
      }));
    }
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CUSTOMER endpoints (DynamoDB + EFS)
app.get('/api/customers', async (req, res) => {
  try {
    const result = await dynamoClient.send(new ScanCommand({
      TableName: process.env.DYNAMODB_TABLE
    }));
    res.json(result.Items || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers', uploadEFS.single('avatar'), async (req, res) => {
  const { name, location, dob, description } = req.body;
  try {
    const customer = {
      id: Date.now().toString(),
      name,
      location,
      dob,
      description,
      avatar: req.file ? `/avatars/${req.file.filename}` : null
    };

    await dynamoClient.send(new PutCommand({
      TableName: process.env.DYNAMODB_TABLE,
      Item: customer
    }));

    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/customers/:id', uploadEFS.single('avatar'), async (req, res) => {
  const { name, location, dob, description } = req.body;
  try {
    const customer = {
      id: req.params.id,
      name,
      location,
      dob,
      description,
      avatar: req.file ? `/avatars/${req.file.filename}` : req.body.avatar
    };

    await dynamoClient.send(new PutCommand({
      TableName: process.env.DYNAMODB_TABLE,
      Item: customer
    }));

    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    await dynamoClient.send(new DeleteCommand({
      TableName: process.env.DYNAMODB_TABLE,
      Key: { id: req.params.id }
    }));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`S3 Bucket: ${process.env.S3_BUCKET}`);
  console.log(`DynamoDB Table: ${process.env.DYNAMODB_TABLE}`);
  console.log(`EFS Path: ${process.env.EFS_PATH}`);
});
