#!/bin/bash
set -e

echo "Running AfterInstall hook..."

cd /home/ec2-user/app

# Install production dependencies
echo "Installing npm dependencies..."
npm install --production

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo "Creating .env file..."
  cat > .env <<EOF
PORT=3001
UPLOAD_DIR=/mnt/efs
EOF
fi

# Set correct permissions
chown -R ec2-user:ec2-user /home/ec2-user/app

echo "AfterInstall completed successfully"
