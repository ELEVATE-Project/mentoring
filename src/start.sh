#!/bin/sh
set -e

# Replace kafka.js with kafka.ci.js
cp /var/src/configs/kafka.ci.js /var/src/configs/kafka.js

# echo "[MENTORING] Running migrations..."
# npm run db:init:integration

# echo "[MENTORING] Running seeds..."
# npm run db:seed:all:integration
# running script
# running script 2

echo "[MENTORING] Starting application..."
npm run dev
