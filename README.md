# Product-Provider Management Application

## Architecture
- **Application Tier**: Node.js on EC2 with Auto Scaling
- **Load Balancer**: Application Load Balancer (ALB)
- **Database**: RDS PostgreSQL (providers)

## Setup Instructions

### 1. Prerequisites
- EC2 instance with Node.js installed

### 2. Database Setup

**RDS PostgreSQL:**
Connect to your RDS instance and run:
```bash
psql -h db.viet.vn -U admin -d products_db -f setup.sql
```

### 3. Application Deployment

Update `app_config.json` with your actual credentials and endpoints.

Install dependencies and start:
```bash
npm install
npm start
```

Access the web interface at: `http://<EC2-Public-IP>:3000`

### 4. Auto Scaling Configuration

Create Launch Template with:
- AMI with Node.js and application code
- User data script to start application

Create Auto Scaling Group:
- Min: 2, Max: 10, Desired: 2
- Target tracking policy (CPU 70%)
- Attach to ALB target group

### 5. ALB Setup

- Create ALB with target group (port 3000)
- Health check: `/health`
- Register Auto Scaling Group

### 6. EC2 Security Group

Ensure your EC2 security group allows:
- Port 3000 (from ALB or 0.0.0.0/0 for testing)
- Port 22 (SSH for management)

### 7. Quick Deploy to EC2

```bash
# SSH to EC2
ssh -i your-key.pem ec2-user@<EC2-IP>

# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs git

# Clone/upload your application
git clone <your-repo> || scp -r ./architecting ec2-user@<EC2-IP>:~

# Navigate and install
cd architecting
npm install

# Start application with systemd
sudo systemctl start product-app
sudo systemctl enable product-app
```

## API Endpoints

**Providers (RDS PostgreSQL):**
- `POST /providers` - Create provider
- `GET /providers` - List all providers
- `GET /providers/:id` - Get provider by ID
- `PUT /providers/:id` - Update provider
- `DELETE /providers/:id` - Delete provider

## Configuration

All connection parameters are in `app_config.json`:
- RDS PostgreSQL connection details
- Server port
