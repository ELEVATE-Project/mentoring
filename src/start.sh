#!/bin/sh
set -e

echo "[MENTORING] Running migrations..."
npm run db:init

echo "[MENTORING] Running seeds..."
npm run db:seed:all

echo "[MENTORING] Starting application..."
npm run dev
