#!/bin/bash
set -e

# Variables - UPDATE THESE
RDS_HOST="database-2.cluster-crkedvynyebh.us-east-1.rds.amazonaws.com"
RDS_PORT="5432"
RDS_DATABASE="providers_db"
RDS_USER="dbadmin"
RDS_PASSWORD="YourPassword"
PGPASSWORD=$RDS_PASSWORD

# Update system
dnf update -y

# Install Node.js 22, Git, and PostgreSQL
dnf install -y nodejs22 git postgresql17

# Clone application from GitHub
cd /home/ec2-user
git clone https://github.com/vietaws/architecting.git
cd architecting

# Run the SQL script
psql -h $RDS_HOST -U $RDS_USER -d $RDS_DATABASE -f setup.sql || true

# Unset password
unset PGPASSWORD

# Create config file
cat > app_config.json <<EOF
{
  "rds": {
    "host": "${RDS_HOST}",
    "port": ${RDS_PORT},
    "database": "${RDS_DATABASE}",
    "user": "${RDS_USER}",
    "password": "${RDS_PASSWORD}"
  },
  "server": {
    "port": 3000
  }
}
EOF

# Install dependencies
npm install

# Set ownership
chown -R ec2-user:ec2-user /home/ec2-user/architecting

# Create systemd service
cat > /etc/systemd/system/product-app.service <<'EOFS'
[Unit]
Description=Product Provider Application
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/architecting
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=product-app

[Install]
WantedBy=multi-user.target
EOFS

# Enable and start service
systemctl daemon-reload
systemctl enable product-app
systemctl start product-app

# Wait for app to start
sleep 5

# Check status
systemctl status product-app --no-pager
