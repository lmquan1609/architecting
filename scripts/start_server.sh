#!/bin/bash
cd /home/ec2-user/app
nohup node index.js > /var/log/app.log 2>&1 &
sleep 2
pgrep -f "node index.js" > /dev/null || exit 1
exit 0