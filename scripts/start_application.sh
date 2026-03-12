#!/bin/bash
set -e

echo "Running ApplicationStart hook..."

# Create systemd service if it doesn't exist
if [ ! -f /etc/systemd/system/demo-app.service ]; then
  echo "Creating systemd service..."
  cat > /etc/systemd/system/demo-app.service <<'EOF'
[Unit]
Description=Image Upload Application
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/app
EnvironmentFile=/home/ec2-user/app/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=demo-app

[Install]
WantedBy=multi-user.target
EOF
fi

# Reload systemd and start service
systemctl daemon-reload
systemctl enable demo-app
systemctl start demo-app

# Wait for service to start
sleep 5

echo "ApplicationStart completed successfully"
