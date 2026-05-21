import express from 'express';
const app = express();
const PORT = 3001;

app.get('/', (req, res) => {
  res.send(`
    <body style='background-color: #283E5B; text-align: center;color: orange;'>
      <h2>Hello from AWS Architecting Lab - v3</h2>
    <body>
  `);
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});