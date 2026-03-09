# Providers Directory

Minimal Node.js/Express app with PostgreSQL for AWS EC2 (Amazon Linux 2023, ARM).

## Setup

1. Install dependencies:
```bash
npm install
```

2. Initialize PostgreSQL database:
```bash
psql -U postgres -f init.sql
```

3. Configure environment (copy `.env.example` to `.env` and update):
```bash
cp .env.example .env
```

4. Start server:
```bash
npm start
```

## EC2 Deployment

Install Node.js on Amazon Linux 2023 ARM:
```bash
sudo dnf install nodejs -y
```

Install PostgreSQL 17:
```bash
sudo dnf install postgresql17 postgresql17-server -y
sudo postgresql-setup --initdb
sudo systemctl enable postgresql
sudo systemctl start postgresql
```
