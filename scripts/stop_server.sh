#!/bin/bash
if pgrep -f "node index.js" > /dev/null; then
  pkill -f "node index.js"
  sleep 2
fi
exit 0