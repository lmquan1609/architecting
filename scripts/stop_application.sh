#!/bin/bash
echo "Running ApplicationStop hook..."

# Stop application if running
if systemctl is-active --quiet demo-app; then
  echo "Stopping demo-app service..."
  systemctl stop demo-app
else
  echo "demo-app service is not running"
fi

echo "ApplicationStop completed successfully"
