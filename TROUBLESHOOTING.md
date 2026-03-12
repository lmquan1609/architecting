# Troubleshooting Guide

## Check Application Logs

```bash
sudo journalctl -u crm-app -f
```

Look for these startup messages:
```
Server running on port 3001
S3 Bucket: crm-demo-bucket
DynamoDB Table: customers
EFS Path: /mnt/efs
AWS Region: us-east-1
Database Ready: true
```

## Common Issues

### 1. Cannot Upload Images to S3

**Symptoms:** Error when uploading product images

**Check:**
```bash
# Verify S3 bucket exists
aws s3 ls s3://crm-demo-bucket

# Check IAM permissions
aws sts get-caller-identity

# Test S3 upload manually
echo "test" > /tmp/test.txt
aws s3 cp /tmp/test.txt s3://crm-demo-bucket/test.txt
```

**Fix:**
- Ensure EC2 IAM role has `s3:PutObject` permission
- Verify S3_BUCKET in .env matches actual bucket name
- Check bucket exists in same region

### 2. Cannot Upload Avatars to EFS

**Symptoms:** Error when uploading customer avatars

**Check:**
```bash
# Verify EFS is mounted
df -h | grep efs
mountpoint /mnt/efs

# Check permissions
ls -la /mnt/efs

# Test write access
sudo -u ec2-user touch /mnt/efs/test.txt
```

**Fix:**
```bash
# Remount EFS
sudo mount -t efs -o tls fs-xxxxxxxxx:/ /mnt/efs

# Fix permissions
sudo chown -R ec2-user:ec2-user /mnt/efs
sudo chmod 755 /mnt/efs
```

### 3. Cannot Insert to RDS

**Symptoms:** "Database not ready" or connection errors

**Check:**
```bash
# Test database connection
psql "host=your-rds-endpoint port=5432 dbname=demo user=dbadmin sslmode=require"

# Check application logs
sudo journalctl -u crm-app -n 50 | grep -i database
```

**Fix:**
- Verify RDS security group allows port 5432 from EC2
- Check DB_HOST in .env matches RDS endpoint
- Verify dbadmin user has permissions:
```sql
GRANT ALL PRIVILEGES ON TABLE products TO dbadmin;
GRANT ALL PRIVILEGES ON SEQUENCE products_id_seq TO dbadmin;
```

### 4. Cannot Insert to DynamoDB

**Symptoms:** Error when creating customers

**Check:**
```bash
# Verify table exists
aws dynamodb describe-table --table-name customers

# Test write access
aws dynamodb put-item \
  --table-name customers \
  --item '{"id":{"S":"test"},"name":{"S":"Test"}}'

# Check IAM permissions
aws iam get-role --role-name your-ec2-role
```

**Fix:**
- Ensure EC2 IAM role has `dynamodb:PutItem` permission
- Verify DYNAMODB_TABLE in .env matches actual table name
- Check table exists in same region

## Verify Environment Variables

```bash
cat /home/ec2-user/architecting/.env
```

Should contain:
```
DB_SECRET_NAME=rds-credentials
DB_HOST=demo-db.xxxxx.rds.amazonaws.com
DB_PORT=5432
DB_USER=dbadmin
DB_PASSWORD=your-password
S3_BUCKET=crm-demo-bucket
DYNAMODB_TABLE=customers
EFS_PATH=/mnt/efs
AWS_REGION=us-east-1
PORT=3001
```

## Check IAM Role Permissions

```bash
# Get instance profile
aws ec2 describe-instances \
  --instance-ids $(ec2-metadata --instance-id | cut -d " " -f 2) \
  --query 'Reservations[0].Instances[0].IamInstanceProfile.Arn'

# List attached policies
aws iam list-attached-role-policies --role-name your-role-name
```

Required permissions:
- `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on S3 bucket
- `dynamodb:PutItem`, `dynamodb:Scan`, `dynamodb:DeleteItem` on DynamoDB table
- `secretsmanager:GetSecretValue` on RDS secret

## Restart Application

```bash
sudo systemctl restart crm-app
sudo systemctl status crm-app
sudo journalctl -u crm-app -f
```

## Test Each Component

### Test RDS
```bash
psql "host=your-endpoint port=5432 dbname=demo user=dbadmin sslmode=require" <<EOF
SELECT * FROM products;
INSERT INTO products (name, qty) VALUES ('Test', 1);
DELETE FROM products WHERE name = 'Test';
EOF
```

### Test S3
```bash
echo "test" > /tmp/test.txt
aws s3 cp /tmp/test.txt s3://your-bucket/test.txt
aws s3 ls s3://your-bucket/
aws s3 rm s3://your-bucket/test.txt
```

### Test DynamoDB
```bash
aws dynamodb put-item --table-name customers \
  --item '{"id":{"S":"test123"},"name":{"S":"Test User"}}'
  
aws dynamodb scan --table-name customers

aws dynamodb delete-item --table-name customers \
  --key '{"id":{"S":"test123"}}'
```

### Test EFS
```bash
sudo -u ec2-user touch /mnt/efs/test.txt
ls -la /mnt/efs/test.txt
rm /mnt/efs/test.txt
```

## Enable Debug Mode

Add to .env:
```
NODE_ENV=development
```

Restart application to see detailed logs.
