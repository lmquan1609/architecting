#!/bin/bash
set -e

# Install Node.js and PostgreSQL 17
dnf install -y nodejs postgresql17 postgresql17-server git

# Initialize PostgreSQL
postgresql-setup --initdb
systemctl enable postgresql
systemctl start postgresql

# Setup PostgreSQL user and database
sudo -u postgres psql <<EOF
CREATE DATABASE providers_db;
\c providers_db
CREATE TABLE providers (
  provider_id SERIAL PRIMARY KEY,
  provider_name VARCHAR(255) NOT NULL,
  provider_city VARCHAR(255) NOT NULL
);
INSERT INTO providers (provider_name, provider_city) VALUES
  ('Tech Solutions Inc', 'San Francisco'),
  ('Global Services Ltd', 'New York'),
  ('Innovation Partners', 'Austin');
ALTER USER postgres WITH PASSWORD 'postgres';
EOF

# Configure PostgreSQL to allow local connections
echo "host all all 127.0.0.1/32 md5" >> /var/lib/pgsql/data/pg_hba.conf
systemctl restart postgresql

# Deploy application
cd /home/ec2-user
git clone -b simple-system https://github.com/vietaws/architecting.git app || mkdir -p app
cd app

# Create .env file
cat > .env <<EOF
DB_HOST=10.0.147.111
DB_PORT=5432
DB_USER=dbadmin
DB_PASSWORD=your_secure_password
PORT=3000
EOF

# Install dependencies
npm install

# Create systemd service
cat > /etc/systemd/system/providers.service <<EOF
[Unit]
Description=Providers Directory App
After=network.target postgresql.service

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/app
EnvironmentFile=/home/ec2-user/app/.env
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Set permissions
chown -R ec2-user:ec2-user /home/ec2-user/app

# Start service
systemctl daemon-reload
systemctl enable providers.service
systemctl start providers.service
