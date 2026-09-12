import express from 'express';
import { request } from 'http';

const app = express();
const PORT = process.env.PORT || 3001;

function getInstanceId() {
  return new Promise((resolve) => {
    // IMDSv2: get token first
    const tokenReq = request(
      { hostname: '169.254.169.254', path: '/latest/api/token', method: 'PUT',
        headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' } },
      (res) => {
        let token = '';
        res.on('data', (d) => token += d);
        res.on('end', () => {
          const idReq = request(
            { hostname: '169.254.169.254', path: '/latest/meta-data/instance-id', method: 'GET',
              headers: { 'X-aws-ec2-metadata-token': token.trim() } },
            (r) => {
              let id = '';
              r.on('data', (d) => id += d);
              r.on('end', () => resolve(id.trim()));
            }
          );
          idReq.on('error', () => resolve('unknown'));
          idReq.end();
        });
      }
    );
    tokenReq.on('error', () => resolve('unknown'));
    tokenReq.end();
  });
}

app.get('/', async (req, res) => {
  const instanceId = await getInstanceId();
  res.send(`
    <body style='background-color: #283E5B; text-align: center;color: orange;'>
      <h2>Hello from AWS Architecting Lab - v1.3</h2>
      <h3>Instance ID: ${instanceId}</h3>
    </body>
  `);
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
