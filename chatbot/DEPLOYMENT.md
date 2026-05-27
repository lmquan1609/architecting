# Chatbot Deployment Guide

Deploy the RAG chatbot: Lambda + API Gateway WebSocket + S3 + CloudFront.

**Region**: `us-east-1`

## File Structure

```
chatbot/
├── lambda/
│   ├── connect/index.mjs      ← $connect / $disconnect handler
│   └── default/index.mjs      ← $default handler (Bedrock streaming)
└── frontend/
    ├── index.html
    ├── style.css
    └── app.js                 ← update WS_URL before uploading
```

---

## Step 1 — Create the IAM Role for Lambda

1. Open **IAM console** → **Roles** → **Create role**
2. Trusted entity: **AWS service** → **Lambda** → Next
3. Attach these policies:
   - `AWSLambdaBasicExecutionRole`
   - `AmazonBedrockFullAccess`
4. Name the role: `ChatbotLambdaRole` → **Create role**
5. Note the **Role ARN** — you'll need it in Step 2

---

## Step 2 — Deploy the Connect Lambda

This handles `$connect` and `$disconnect` routes.

1. Open **Lambda console** → **Create function**
2. Settings:
   - **Name**: `chatbot-connect`
   - **Runtime**: `Node.js 22.x`
   - **Architecture**: `x86_64`
   - **Execution role**: Use existing → `ChatbotLambdaRole`
3. Click **Create function**
4. In the **Code** tab, open `index.mjs` and replace with the contents of `chatbot/lambda/connect/index.mjs`
5. Click **Deploy**

---

## Step 3 — Deploy the Default Lambda

This handles `$default` route — streams Bedrock responses back over WebSocket.

1. Open **Lambda console** → **Create function**
2. Settings:
   - **Name**: `chatbot-default`
   - **Runtime**: `Node.js 22.x`
   - **Architecture**: `x86_64`
   - **Execution role**: Use existing → `ChatbotLambdaRole`
3. Click **Create function**
4. In the **Code** tab, open `index.mjs` and replace with the contents of `chatbot/lambda/default/index.mjs`
5. Click **Deploy**

### Add environment variables

In the **Configuration** tab → **Environment variables** → **Edit** → **Add**:

| Key | Value |
|-----|-------|
| `KNOWLEDGE_BASE_ID` | Your Bedrock KB ID (from the KB console) |

> `AWS_REGION` is automatically set by Lambda — no need to add it manually.

### Increase timeout

In **Configuration** → **General configuration** → **Edit**:
- **Timeout**: `1 min 0 sec` (Bedrock streaming can take up to ~30s for long answers)

---

## Step 4 — Create the API Gateway WebSocket API

1. Open **API Gateway console** → **Create API**
2. Choose **WebSocket API** → **Build**
3. Settings:
   - **API name**: `chatbot-ws`
   - **Route selection expression**: `$request.body.action`
4. Click **Next**

### Add routes

You need three routes:

| Route key | Integration |
|-----------|-------------|
| `$connect` | `chatbot-connect` Lambda |
| `$disconnect` | `chatbot-connect` Lambda |
| `$default` | `chatbot-default` Lambda |

For each route:
- Click **Add route** → enter the route key
- **Integration type**: Lambda function
- Select the corresponding Lambda function
- Check **Grant API Gateway permission to invoke Lambda**
- Click **Next** through the remaining screens

5. **Stage name**: `prod`
6. Click **Create and deploy**

### Note the WebSocket URL

After deployment, the console shows:
```
wss://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod
```
Copy this — you need it in Step 5.

### Grant API Gateway permission to call back to connections

The default Lambda needs permission to call `execute-api:ManageConnections`. This is already covered by `AmazonBedrockFullAccess` not including it — add an inline policy to `ChatbotLambdaRole`:

1. IAM console → Roles → `ChatbotLambdaRole` → **Add permissions** → **Create inline policy**
2. Switch to **JSON** and paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "execute-api:ManageConnections",
      "Resource": "arn:aws:execute-api:us-east-1:*:*/@connections/*"
    }
  ]
}
```

3. Name it `AllowWebSocketCallback` → **Create policy**

---

## Step 5 — Update the Frontend WebSocket URL

Open `chatbot/frontend/app.js` and replace the placeholder:

```js
const WS_URL = 'wss://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod';
```

with your actual WebSocket URL from Step 4.

---

## Step 6 — Create the S3 Bucket for Static Hosting

1. Open **S3 console** → **Create bucket**
2. Settings:
   - **Bucket name**: `miracle-chatbot-frontend-<your-account-id>`
   - **Region**: `us-east-1`
   - **Block all public access**: leave **enabled** (CloudFront will access it via OAC)
3. Click **Create bucket**

### Upload frontend files

1. Open the bucket → **Upload**
2. Upload all three files: `index.html`, `style.css`, `app.js`
3. Click **Upload**

---

## Step 7 — Create the CloudFront Distribution

1. Open **CloudFront console** → **Create distribution**

### Origin settings
- **Origin domain**: select your S3 bucket from the dropdown (`miracle-chatbot-frontend-<id>.s3.us-east-1.amazonaws.com`)
- **Origin access**: select **Origin access control settings (recommended)**
- Click **Create new OAC** → accept defaults → **Create**
- CloudFront will prompt you to update the S3 bucket policy — do this after creating the distribution

### Default cache behavior
- **Viewer protocol policy**: `Redirect HTTP to HTTPS`
- **Allowed HTTP methods**: `GET, HEAD`
- Leave everything else as default

### Settings
- **Default root object**: `index.html`
- Leave price class and other settings as default

2. Click **Create distribution**
3. Wait for status to change from **Deploying** to **Enabled** (~5 minutes)

### Update the S3 bucket policy

CloudFront shows a banner: **"Copy policy"** — click it, then:

1. Go to your S3 bucket → **Permissions** tab → **Bucket policy** → **Edit**
2. Paste the copied policy → **Save changes**

### Get your CloudFront URL

On the distribution detail page, copy the **Distribution domain name**:
```
https://XXXXXXXXXXXX.cloudfront.net
```

---

## Step 8 — Test End to End

1. Open `https://XXXXXXXXXXXX.cloudfront.net` in your browser
2. Type a question, e.g.: `What products does Miracle Technologies offer?`
3. You should see the response stream in token by token, with a source citation at the end

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| WebSocket connection fails | Check the `WS_URL` in `app.js` matches the deployed stage URL |
| Lambda times out | Increase timeout to 1 minute (Step 3) |
| `execute-api:ManageConnections` error in Lambda logs | Add the inline policy from Step 4 |
| CloudFront returns 403 | Ensure the S3 bucket policy was updated with the OAC policy |
| No response / empty answer | Verify `KNOWLEDGE_BASE_ID` env var is set and the KB sync is complete |
| CORS error on WebSocket | WebSocket connections don't use CORS — this is a different issue; check the browser console for the actual error |
