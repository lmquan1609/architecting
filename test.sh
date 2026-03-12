#!/bin/bash
set -e

echo "Running HTML content tests..."

# Test 1: Check if h1 tag contains "AWS Storage"
if grep -q '<h1>.*AWS Storage.*</h1>' public/index.html; then
  echo "✓ Test passed: h1 tag contains 'AWS Storage'"
else
  echo "✗ Test failed: h1 tag does not contain 'AWS Storage'"
  exit 1
fi

echo "All tests passed!"
