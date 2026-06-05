#!/bin/sh
set -e

echo "[MOE Backend] Pushing database schema..."
npx prisma db push --accept-data-loss

echo "[MOE Backend] Checking if seed is needed..."
USER_COUNT=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.count()
  .then(n => { console.log(n); return p.\$disconnect(); })
  .catch(() => { console.log('0'); process.exit(0); });
" 2>/dev/null || echo "0")

if [ "$USER_COUNT" = "0" ]; then
  echo "[MOE Backend] Seeding database..."
  npm run seed
else
  echo "[MOE Backend] Database already has $USER_COUNT users, skipping seed."
fi

echo "[MOE Backend] Starting server on port ${PORT:-4000}..."
exec npx tsx src/index.ts
