#!/bin/bash
set -e

echo "Running ValidateService hook..."

# Wait for application to fully start
sleep 10

# Check if service is running
if ! systemctl is-active --quiet demo-app; then
  echo "ERROR: demo-app service is not running"
  systemctl status demo-app
  exit 1
fi

# Health check - test metadata endpoint
echo "Performing health check..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/metadata || echo "000")

if [ "$response" = "200" ]; then
  echo "✓ Health check passed (HTTP $response)"
  echo "✓ Application is healthy and responding"
  exit 0
else
  echo "✗ Health check failed (HTTP $response)"
  echo "Application logs:"
  journalctl -u demo-app -n 50 --no-pager
  exit 1
fi
