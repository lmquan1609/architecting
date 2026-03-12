#!/bin/bash
set -e

echo "Running BeforeInstall hook..."

# Install dependencies if not present
if ! command -v node &> /dev/null; then
  echo "Installing Node.js..."
  dnf install -y nodejs22
fi

if ! command -v amazon-efs-utils &> /dev/null; then
  echo "Installing EFS utilities..."
  dnf install -y amazon-efs-utils python3 python3-pip
  pip3 install botocore
fi

# Get EFS ID from environment or SSM Parameter Store
EFS_ID=${EFS_ID:-$(aws ssm get-parameter --name /app/efs-id --query 'Parameter.Value' --output text 2>/dev/null || echo "")}

if [ -n "$EFS_ID" ]; then
  # Mount EFS if not mounted
  if ! mountpoint -q /mnt/efs; then
    echo "Mounting EFS: $EFS_ID"
    mkdir -p /mnt/efs
    mount -t efs -o tls ${EFS_ID}:/ /mnt/efs
    
    # Add to fstab if not present
    if ! grep -q "$EFS_ID" /etc/fstab; then
      echo "${EFS_ID}:/ /mnt/efs efs _netdev,tls 0 0" >> /etc/fstab
    fi
    
    chown ec2-user:ec2-user /mnt/efs
    chmod 755 /mnt/efs
  fi
else
  echo "Warning: EFS_ID not set. Skipping EFS mount."
fi

# Create app directory
mkdir -p /home/ec2-user/app
chown ec2-user:ec2-user /home/ec2-user/app

echo "BeforeInstall completed successfully"
