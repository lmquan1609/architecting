# AWS Simple Data Lake — Demo Guide

## Scenario

An e-commerce company collects raw order and clickstream events. The data lake ingests raw data, transforms it into a queryable format, and serves analytics — all on AWS with S3 as the backbone.

```
[Data Sources]
  App Events (JSON)
  CSV Uploads (orders)
        │
        ▼
[S3 — Raw Zone]          (s3://datalake/raw/)
        │
        ▼
[AWS Glue — ETL Job]     (clean, convert to Parquet)
        │
        ▼
[S3 — Processed Zone]    (s3://datalake/processed/)
        │
        ▼
[AWS Glue Crawler]       (auto-discover schema → Data Catalog)
        │
        ▼
[Amazon Athena]          (SQL queries on S3)
```

---

## AWS Services Used

| Service | Role |
|---|---|
| S3 | Storage backbone — raw, processed, failed zones |
| AWS Glue (ETL + Crawler) | Transform data + auto-catalog schema |
| Glue Data Catalog | Central metadata store |
| Amazon Athena | Serverless SQL queries on S3 |
| IAM | Least-privilege roles per service |
| S3 Lifecycle Policies | Auto-archive old raw data to Glacier |
| CloudWatch | Monitor Glue job metrics |
| AWS Lake Formation | Fine-grained table/column/row-level access control |

---

## Step-by-Step Demo

### Step 1 — Create S3 Bucket with Zone Prefixes

```bash
aws s3api create-bucket \
  --bucket my-datalake-demo \
  --region ap-southeast-1 \
  --create-bucket-configuration LocationConstraint=ap-southeast-1

# Create logical zones as prefixes
aws s3api put-object --bucket my-datalake-demo --key raw/
aws s3api put-object --bucket my-datalake-demo --key processed/
aws s3api put-object --bucket my-datalake-demo --key failed/
aws s3api put-object --bucket my-datalake-demo --key athena-results/
```

Block all public access:

```bash
aws s3api put-public-access-block \
  --bucket my-datalake-demo \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

---

### Step 2 — Set S3 Lifecycle Policy (Raw Zone → Glacier after 90 days)

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket my-datalake-demo \
  --lifecycle-configuration file://lifecycle.json
```

`lifecycle.json`:

```json
{
  "Rules": [{
    "ID": "archive-raw",
    "Filter": { "Prefix": "raw/" },
    "Status": "Enabled",
    "Transitions": [{
      "Days": 90,
      "StorageClass": "GLACIER"
    }]
  }]
}
```

---

### Step 3 — Create IAM Role

**Glue role** — can read `raw/`, write `processed/`, and update Glue Data Catalog

```bash
aws iam attach-role-policy \
  --role-name GlueDatalakeRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole
```

---

### Step 4 — Upload Sample Data to Raw Zone

```bash
# Create a sample JSON file
echo '{"order_id":"123","user_id":"456","amount":99.99}' > order1.json
echo '{"order_id":"124","user_id":"789","amount":45.00}' >> order1.json

aws s3 cp order1.json s3://my-datalake-demo/raw/year=2026/month=04/day=24/order1.json
```

---

### Step 5 — Create Glue ETL Job (JSON → Parquet)

1. Go to **AWS Glue → ETL Jobs → Create job**
2. Choose **Spark script editor**
3. Use the script at `glue/transform.py` (see below)
4. IAM role: `GlueDatalakeRole`
5. Job parameters:
   - `--SOURCE_PATH` = `s3://my-datalake-demo/raw/`
   - `--DEST_PATH` = `s3://my-datalake-demo/processed/`

`glue/transform.py` (minimal):

```python
import sys
from awsglue.context import GlueContext
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext

args = getResolvedOptions(sys.argv, ['SOURCE_PATH', 'DEST_PATH'])
sc = SparkContext()
gc = GlueContext(sc)

df = gc.spark_session.read.json(args['SOURCE_PATH'])
df.write.mode("overwrite").parquet(args['DEST_PATH'])
```

---

### Step 6 — Create Glue Crawler (Auto-catalog Processed Zone)

```bash
aws glue create-crawler \
  --name datalake-processed-crawler \
  --role arn:aws:iam::<account-id>:role/GlueDatalakeRole \
  --database-name datalake_db \
  --targets '{"S3Targets": [{"Path": "s3://my-datalake-demo/processed/"}]}'

aws glue start-crawler --name datalake-processed-crawler
```

After the crawler runs, a table appears in **Glue Data Catalog → datalake_db**.

---

### Step 7 — Query with Athena

1. Go to **Athena → Query editor**
2. Set workgroup output to `s3://my-datalake-demo/athena-results/`
3. Run:

```sql
SELECT order_id, user_id, amount
FROM datalake_db.processed
WHERE amount > 50
LIMIT 10;
```

---

## Part 2: Fine-Grained Access Control with AWS Lake Formation

Build on top of the existing setup to enforce **table-level**, **column-level**, and **row-level** access control using Lake Formation — replacing broad IAM/S3 bucket policies with granular data permissions.

### Architecture Addition

```
[Glue Data Catalog]
        │
        ▼
[AWS Lake Formation]   ← central permission layer
        │
   ┌────┴────┐
   ▼         ▼
[Analyst A] [Analyst B]
(full table) (masked columns, filtered rows)
```

---

### Step 8 — Bootstrap Lake Formation

#### 8.1 Set Lake Formation as the Permission Model

```bash
aws lakeformation put-data-lake-settings \
  --data-lake-settings '{
    "DataLakeAdmins": [
      {"DataLakePrincipalIdentifier": "arn:aws:iam::<account-id>:role/LakeAdminRole"}
    ],
    "CreateDatabaseDefaultPermissions": [],
    "CreateTableDefaultPermissions": []
  }'
```

> Setting `CreateDatabaseDefaultPermissions` and `CreateTableDefaultPermissions` to empty arrays **disables** the default IAM-only fallback, forcing all access through Lake Formation.

#### 8.2 Register the S3 Data Lake Location

```bash
aws lakeformation register-resource \
  --resource-arn arn:aws:s3:::my-datalake-demo \
  --use-service-linked-role
```

This hands S3 location control to Lake Formation. The service-linked role (`AWSServiceRoleForLakeFormationDataAccess`) will be created automatically.

---

### Step 9 — Grant Database & Table Permissions

#### 9.1 Grant Glue Crawler Permission to Create Tables

```bash
aws lakeformation grant-permissions \
  --principal DataLakePrincipalIdentifier=arn:aws:iam::<account-id>:role/GlueDatalakeRole \
  --resource '{"Database": {"Name": "datalake_db"}}' \
  --permissions CREATE_TABLE ALTER DROP
```

#### 9.2 Grant Analyst A — Full Table Access

```bash
aws lakeformation grant-permissions \
  --principal DataLakePrincipalIdentifier=arn:aws:iam::<account-id>:user/analyst-a \
  --resource '{"Table": {"DatabaseName": "datalake_db", "Name": "processed"}}' \
  --permissions SELECT DESCRIBE
```

#### 9.3 Grant Analyst B — Column-Level Access (hide `user_id`)

```bash
aws lakeformation grant-permissions \
  --principal DataLakePrincipalIdentifier=arn:aws:iam::<account-id>:user/analyst-b \
  --resource '{
    "TableWithColumns": {
      "DatabaseName": "datalake_db",
      "Name": "processed",
      "ColumnNames": ["order_id", "amount"]
    }
  }' \
  --permissions SELECT
```

> Analyst B can only see `order_id` and `amount` — `user_id` is invisible in Athena queries.

---

### Step 10 — Row-Level Security with Data Filters

Restrict Analyst B to only see orders where `amount > 50`.

#### 10.1 Create a Data Filter

```bash
aws lakeformation create-data-cells-filter \
  --table-data \
    "DatabaseName=datalake_db,TableName=processed,Name=high-value-orders,\
RowFilter={FilterExpression='amount > 50'},\
ColumnWildcard={}"
```

#### 10.2 Grant the Filter to Analyst B

```bash
aws lakeformation grant-permissions \
  --principal DataLakePrincipalIdentifier=arn:aws:iam::<account-id>:user/analyst-b \
  --resource '{
    "DataCellsFilter": {
      "DatabaseName": "datalake_db",
      "TableName": "processed",
      "Name": "high-value-orders"
    }
  }' \
  --permissions SELECT
```

---

### Step 11 — Verify Permissions in Athena

**As Analyst A** — sees all rows and columns:

```sql
SELECT * FROM datalake_db.processed LIMIT 10;
-- Returns: order_id, user_id, amount
```

**As Analyst B** — sees only filtered rows and allowed columns:

```sql
SELECT * FROM datalake_db.processed LIMIT 10;
-- Returns: order_id, amount  (user_id hidden)
-- Only rows where amount > 50
```

---

### Step 12 — Audit Access with CloudTrail + Lake Formation Logs

Lake Formation automatically logs all data access decisions to CloudTrail.

```bash
# Find recent Lake Formation access events
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventSource,AttributeValue=lakeformation.amazonaws.com \
  --max-results 10
```

Key events to monitor:
- `GetDataAccess` — triggered every time Athena requests temporary S3 credentials
- `GrantPermissions` / `RevokePermissions` — permission changes

---

### Step 13 — Revoke Access

```bash
# Revoke Analyst B's table access
aws lakeformation revoke-permissions \
  --principal DataLakePrincipalIdentifier=arn:aws:iam::<account-id>:user/analyst-b \
  --resource '{"Table": {"DatabaseName": "datalake_db", "Name": "processed"}}' \
  --permissions SELECT
```

---

## Project Structure

```
data-lake/
├── README.md
├── lifecycle.json
└── glue/
    └── transform.py
```

---

## Key Concepts Demonstrated

**Part 1 — Core Data Lake**
- S3 as a multi-zone data lake (raw → processed)
- Manual upload with date-based partitioning
- Schema-on-read with Glue Crawler + Data Catalog
- Serverless SQL with Athena (no database servers)
- Columnar format (Parquet) for cost-efficient queries
- Lifecycle policies for storage cost management

**Part 2 — Lake Formation Governance**
- Centralized permission model replacing IAM/S3 bucket policies
- Table-level access per IAM user/role
- Column-level masking (hide sensitive fields)
- Row-level filtering via Data Cells Filters
- Full audit trail via CloudTrail integration
