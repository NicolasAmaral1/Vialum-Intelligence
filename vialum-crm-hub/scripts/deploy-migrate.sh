#!/bin/sh
set -e

echo "=== CRM Hub Migration ==="

# Try to deploy migrations directly
echo "Running migrations..."
npx prisma migrate deploy --schema prisma/schema.prisma || {
  echo "Direct deploy failed. Attempting baseline resolution..."
  # If deploy fails (tables already exist), resolve as applied
  npx prisma migrate resolve --applied 0000_initial --schema prisma/schema.prisma 2>/dev/null || true
  npx prisma migrate resolve --applied 0001_add_category --schema prisma/schema.prisma 2>/dev/null || true
  # Now deploy only the new migrations
  npx prisma migrate deploy --schema prisma/schema.prisma
}

echo "=== Migration complete ==="
