# Build a RAG Application with Amazon Bedrock Knowledge Bases and Amazon S3 Vectors

This guide walks you through setting up a Retrieval-Augmented Generation (RAG) pipeline using:
- **Amazon S3** — stores your source documents (e.g., `miracle-profile.md`)
- **Amazon Bedrock Knowledge Bases** — manages ingestion, embedding, and retrieval
- **Amazon S3 Vectors** — stores the vector embeddings (auto-created by Bedrock)
- **Amazon Bedrock (Claude 3.5 Sonnet)** — answers questions using retrieved context

**Region**: `us-east-1`  
**Embedding model**: `amazon.titan-embed-text-v2:0`  
**Foundation model**: `anthropic.claude-3-5-sonnet-20241022-v2:0`

---

## Architecture Overview

```
miracle-profile.md
       │
       ▼
  S3 Data Bucket          ← you upload documents here
       │
       ▼
Bedrock Knowledge Base    ← ingests, chunks, and embeds documents
       │
       ▼
  S3 Vector Bucket        ← stores vector embeddings (auto-created)
       │
       ▼
  Query via Console / CLI ← Claude 3.5 Sonnet answers using retrieved chunks
```

---

## Prerequisites

- AWS account with access to `us-east-1`
- IAM user (not root) with permissions for: S3, Bedrock, IAM
- Model access enabled for:
  - `Amazon Titan Text Embeddings V2`
  - `Claude 3.5 Sonnet` (Anthropic)

---

## Step 1 — Enable Model Access in Bedrock

Before creating a knowledge base, ensure the required models are enabled.

1. Open the [Amazon Bedrock console](https://console.aws.amazon.com/bedrock) in `us-east-1`
2. In the left navigation, choose **Model access**
3. Click **Modify model access**
4. Enable the following models:
   - **Amazon → Titan Text Embeddings V2**
   - **Anthropic → Claude 3.5 Sonnet**
5. Click **Save changes** and wait for status to show **Access granted**

---

## Step 2 — Create the S3 Data Bucket and Upload Document

This bucket holds your source documents. It is a standard S3 bucket (not a vector bucket).

### Console

1. Open the [S3 console](https://s3.console.aws.amazon.com/s3)
2. Click **Create bucket**
3. Set:
   - **Bucket name**: `miracle-kb-data-<your-account-id>` (must be globally unique)
   - **Region**: `us-east-1`
   - Leave all other settings as default
4. Click **Create bucket**
5. Open the bucket, click **Upload**, and upload `miracle-profile.md`

### CLI (alternative)

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET_NAME="miracle-kb-data-${ACCOUNT_ID}"

aws s3 mb s3://${BUCKET_NAME} --region us-east-1
aws s3 cp miracle-profile.md s3://${BUCKET_NAME}/
```

---

## Step 3 — Create the Bedrock Knowledge Base

This is the main step. Bedrock will automatically create the S3 vector bucket and vector index for you.

### Console

1. Open the [Amazon Bedrock console](https://console.aws.amazon.com/bedrock) in `us-east-1`
2. In the left navigation, choose **Knowledge bases**
3. Click **Create knowledge base** → select **Knowledge base with vector store**

#### 3a. Knowledge base details
- **Name**: `miracle-knowledge-base`
- **Description**: `Knowledge base for Miracle Technologies company profile`
- **IAM permissions**: Select **Create and use a new service role** — Bedrock will auto-create the role with required permissions

#### 3b. Set up data source
- **Data source name**: `miracle-s3-source`
- **Data source type**: **Amazon S3**
- **S3 URI**: `s3://miracle-kb-data-<your-account-id>/`
- Leave chunking strategy as **Default chunking** (300 tokens, 20% overlap)
- Click **Next**

#### 3c. Select embedding model
- Choose **Titan Text Embeddings V2**
- Dimensions: `1024` (default)
- Embeddings type: `Floating-point` (default)

#### 3d. Select vector store
- Under **Vector database**, choose **Quick create a new vector store**
- Select **Amazon S3 Vectors**
- Bedrock will automatically create:
  - An S3 vector bucket named `bedrock-kb-<random-id>`
  - A vector index inside that bucket
- Leave encryption as default (SSE-S3)

#### 3e. Review and create
- Review all settings
- Click **Create knowledge base**
- Wait for status to change to **Ready** (takes 1–3 minutes)

---

## Step 4 — Sync the Data Source

After the knowledge base is created, you must sync it to ingest and embed your documents.

### Console

1. Open your knowledge base (`miracle-knowledge-base`)
2. In the **Data source** section, select `miracle-s3-source`
3. Click **Sync**
4. Wait for the sync job to complete — status changes to **Ready**
   - For a single small file like `miracle-profile.md`, this takes under 1 minute

### CLI (alternative)

```bash
# Get the knowledge base ID
KB_ID=$(aws bedrock-agent list-knowledge-bases \
  --region us-east-1 \
  --query "knowledgeBaseSummaries[?name=='miracle-knowledge-base'].knowledgeBaseId" \
  --output text)

# Get the data source ID
DS_ID=$(aws bedrock-agent list-data-sources \
  --knowledge-base-id ${KB_ID} \
  --region us-east-1 \
  --query "dataSourceSummaries[0].dataSourceId" \
  --output text)

# Start sync
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id ${KB_ID} \
  --data-source-id ${DS_ID} \
  --region us-east-1
```

---

## Step 5 — Test the Knowledge Base

### Option A: Test in the Bedrock Console

1. Open your knowledge base in the Bedrock console
2. Click **Test knowledge base** (top right)
3. In the right panel, select model: **Claude 3.5 Sonnet**
4. Try the sample prompts below

### Option B: Query via CLI

```bash
KB_ID=$(aws bedrock-agent list-knowledge-bases \
  --region us-east-1 \
  --query "knowledgeBaseSummaries[?name=='miracle-knowledge-base'].knowledgeBaseId" \
  --output text)

aws bedrock-agent-runtime retrieve-and-generate \
  --region us-east-1 \
  --input '{"text": "What products does Miracle Technologies offer?"}' \
  --retrieve-and-generate-configuration "{
    \"type\": \"KNOWLEDGE_BASE\",
    \"knowledgeBaseConfiguration\": {
      \"knowledgeBaseId\": \"${KB_ID}\",
      \"modelArn\": \"arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0\"
    }
  }"
```

---

## Sample Prompts to Try

These prompts are designed to test retrieval against `miracle-profile.md`:

| Prompt | Expected answer source |
|--------|----------------------|
| `What products does Miracle Technologies offer?` | Products section |
| `What was Miracle's revenue in FY 2025?` | Revenue table |
| `What markets does Miracle operate in?` | Highlights section |
| `What is Miracle planning to do with their Series A funding?` | Next investment section |
| `What cloud infrastructure does Miracle use?` | Highlights section |
| `What are Miracle's strategic objectives for 2026 and 2027?` | Objectives section |
| `Does Miracle have any certifications?` | Highlights section |
| `What is MiracleFlow and what does it do?` | Products section |

---

## Step 6 — Clean Up (Optional)

To avoid ongoing charges, delete resources in this order:

### Console
1. **Bedrock Knowledge Base**: Bedrock console → Knowledge bases → select `miracle-knowledge-base` → Delete
   - Choose **Delete** data deletion policy to also remove vectors from the S3 vector bucket
2. **S3 data bucket**: S3 console → empty the bucket → delete the bucket
3. **S3 vector bucket**: S3 console → find the `bedrock-kb-*` vector bucket → empty → delete
4. **IAM role**: IAM console → Roles → find `AmazonBedrockExecutionRoleForKnowledgeBase_*` → delete

### CLI
```bash
# Delete knowledge base (also deletes vectors if deletion policy is DELETE)
aws bedrock-agent delete-knowledge-base \
  --knowledge-base-id ${KB_ID} \
  --region us-east-1

# Delete S3 data bucket
aws s3 rb s3://${BUCKET_NAME} --force --region us-east-1
```

---

## Troubleshooting

| Issue | Likely cause | Fix |
|-------|-------------|-----|
| Knowledge base creation fails | Model access not granted | Complete Step 1 first |
| Sync job fails | S3 bucket permissions | Ensure the Bedrock service role has `s3:GetObject` on your data bucket |
| No results returned | Sync not completed | Check sync status; re-run sync if needed |
| CLI `retrieve-and-generate` returns empty | Wrong KB ID or model ARN | Verify `KB_ID` and use the exact model ARN shown above |

---

## Cost Estimate (Demo Scale)

For a single small document like `miracle-profile.md`:

| Service | Estimated cost |
|---------|---------------|
| S3 data bucket | < $0.01/month |
| S3 vector bucket | < $0.01/month (few KB of vectors) |
| Bedrock embedding (Titan V2) | < $0.01 (one-time ingestion) |
| Bedrock inference (Claude 3.5 Sonnet) | ~$0.003–0.01 per query |

Total for a demo: **under $1**
