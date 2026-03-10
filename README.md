## PART 1: INSTALL & CONFIGURE POSTGRESQL ON AMAZON EC2

### 0. Launch Amazon EC2 on private subnet

- Name: `demo-db`
- Type: `t4g.small`
- Subnet: `db-subnet`
- Security group: `db-sg`
- IAM Instance Profile: `ec2-instance-role`

### 1. Update system packages
bash

`sudo dnf update -y`

### 2. Install PostgreSQL
bash

`sudo dnf install postgresql17-server -y`


### 3. Initialize PostgreSQL database
bash

`sudo postgresql-setup --initdb`


### 4. Start and enable PostgreSQL service
bash

`sudo systemctl start postgresql`

`sudo systemctl enable postgresql`


### 5. Switch to postgres user

bash

`sudo -i -u postgres`


### 6. Create the "demo" database

bash

`createdb demo`


### 7. Verify the database was created

bash

`psql -l`


You should see "demo" in the list of databases.

### 8. Exit postgres user

bash

`exit`

### 9. Optional - Connect to the database:

bash

`sudo -u postgres psql -d demo`


Optional - Configure remote access:
If you need to access PostgreSQL remotely, edit:
- /var/lib/pgsql/data/postgresql.conf - set listen_addresses = '*'
- /var/lib/pgsql/data/pg_hba.conf - add client authentication rules

Then restart: `sudo systemctl restart postgresql`

## PART 2 - CONFIGURE dbadmin FOR POSTGRESQL

### 1. Switch to postgres user and access PostgreSQL
bash

`sudo -u postgres psql`


### 2. Create the dbadmin user with password
sql

`CREATE USER dbadmin WITH PASSWORD 'demoPassword';`


### 3. Grant privileges on the demo database
sql

`GRANT ALL PRIVILEGES ON DATABASE providers TO dbadmin;`


### 4. Connect to the demo database
sql

`\c demo`


### 5. Grant schema privileges (required for PostgreSQL 15+)
sql

`GRANT ALL ON SCHEMA public TO dbadmin;`

`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dbadmin;`

`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dbadmin;`


### 6. Exit psql
sql

`\q`

### 7. Test localhost connection
bash

`psql -h localhost -U dbadmin -d demo`


### 8. Configure authentication

Edit the `pg_hba.conf` and `postgresql` file:

bash
`sudo vi /var/lib/pgsql/data/postgresql.conf`


Find and change:

`listen_addresses = 'localhost'`


To:

`listen_addresses = '*'`


bash

`sudo vi /var/lib/pgsql/data/pg_hba.conf`

Add this line before other rules (for local connections):

`host    demo    dbadmin    127.0.0.1/32    md5`


For remote connections from specific IP:

`host    demo    dbadmin    10.0.0.0/16    md5`


Or for any IP (less secure):

`host    demo    dbadmin    0.0.0.0/0    md5`


### 9. Restart PostgreSQL

bash

`sudo systemctl restart postgresql`


### 10. Verify PostgreSQL is listening

bash

`sudo ss -tuln | grep 5432`

You should see 0.0.0.0:5432 instead of 127.0.0.1:5432


### 11. Test the connection

bash

`psql -h localhost -U dbadmin -d demo`

Enter password: `demoPassword`


### 12. Create table

```sql
CREATE TABLE IF NOT EXISTS providers (
    provider_id VARCHAR(50) PRIMARY KEY,
    provider_name VARCHAR(255) NOT NULL,
    provider_city VARCHAR(100)
);
```

### 11. Test Insert/Select/Delete test records (Optional)

```sql
INSERT INTO providers (provider_id, provider_name, provider_city) VALUES
  ('111', 'Tech Solutions Inc', 'San Francisco'),
  ('222', 'Global Services Ltd', 'New York'),
  ('333', 'Innovation Partners', 'Austin');

SELECT * FROM demo;

DELETE FROM demo;
```

### 12. List tables and records

sql

`\dt`

## PART 3 - INSTALL AND CONFIGURE APPLICATION

### 1. Update system

Login to EC2 via Session Manager

`sudo -i`

`dnf update -y`

### 2. Install Node.js 22, Git, PostgreSQL, and EFS utilities

`dnf install -y nodejs22 git postgresql17`

### 3. Test DB connection

Example:

`psql -h 10.0.147.111 -U dbadmin -d demo`

Enter password: `demoPassword`

Output:
Cannot connect due to connection and security group did not open port 5432.

### 4. Clone application from GitHub

```bash
cd /home/ec2-user
git clone -b lab01-ec2-simple-website https://github.com/vietaws/architecting.git
cd architecting
```


### 5. Create .env file

```bash
cat > .env <<EOF
DB_HOST=10.0.147.111
DB_PORT=5432
DB_USER=dbadmin
DB_PASSWORD=demoPassword
PORT=3001
EOF
```

### 6. Install dependencies
`npm install`

### 7. Set ownership

`chown -R ec2-user:ec2-user /home/ec2-user/architecting`

### 8. Create systemd service
```bash
cat > /etc/systemd/system/demo-app.service <<'EOFS'
[Unit]
Description=AWS Architecting Demo Application - Viet Tran
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
SyslogIdentifier=demo-app

[Install]
WantedBy=multi-user.target
EOFS
```

### 9. Enable and start service

```bash
systemctl daemon-reload
systemctl enable demo-app
systemctl start demo-app
systemctl restart demo-app
```

### 10. Check status

`systemctl status demo-app --no-pager`

### 11. View application logs

```bash
# View logs in real-time:
journalctl -u demo-app -f

# View recent logs:
journalctl -u demo-app -n 50

# View only error logs:
journalctl -u demo-app -p err

# Check service status:
systemctl status demo-app

# Export logs to a file:
journalctl -u demo-app > demo-app.log
```
