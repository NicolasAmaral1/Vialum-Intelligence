#!/bin/sh
set -e

# Run Prisma migrations as root
npx prisma migrate deploy

# Copy Claude auth files and fix permissions for vialum user
if [ -f /root/.claude.json ]; then
  cp /root/.claude.json /home/vialum/.claude.json
  chown vialum:vialum /home/vialum/.claude.json
fi

if [ -d /root/.claude ]; then
  # Copy all files including dotfiles (.credentials.json)
  cp -a /root/.claude/. /home/vialum/.claude/
  chown -R vialum:vialum /home/vialum/.claude
fi

# Start app as non-root user
exec su -s /bin/sh vialum -c "HOME=/home/vialum node /app/dist/index.js"
