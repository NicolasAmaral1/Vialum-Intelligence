#!/usr/bin/env bash
# Creates default buckets and policies for Vialum ecosystem.
# Run once after first `docker compose up -d`.
#
# Prerequisites: mc (MinIO Client) installed
#   brew install minio/stable/mc   (macOS)
#   or: docker exec vialum-minio mc ...

set -euo pipefail

ALIAS="${MINIO_ALIAS:-vialum}"
ENDPOINT="${S3_ENDPOINT:-http://localhost:9000}"
ACCESS_KEY="${S3_ACCESS_KEY:-vialum-admin}"
SECRET_KEY="${S3_SECRET_KEY:-change-this-strong-password-here}"

echo "==> Configuring MinIO alias '${ALIAS}'..."
mc alias set "${ALIAS}" "${ENDPOINT}" "${ACCESS_KEY}" "${SECRET_KEY}"

# --- Buckets ---
# Each bucket isolates a domain. Inside each bucket, objects are
# prefixed by accountId for tenant isolation:
#   media/{accountId}/2026/03/17/{uuid}.pdf

echo "==> Creating buckets..."

# Media files (WhatsApp attachments, generated PDFs)
mc mb --ignore-existing "${ALIAS}/vialum-media"

# Classification results cache
mc mb --ignore-existing "${ALIAS}/vialum-classifications"

# Portal uploads (form attachments)
mc mb --ignore-existing "${ALIAS}/vialum-portal"

# Backups
mc mb --ignore-existing "${ALIAS}/vialum-backups"

# --- Lifecycle rules ---
echo "==> Setting lifecycle rules..."

# Classifications cache: expire after 90 days
mc ilm rule add "${ALIAS}/vialum-classifications" \
  --expire-days 90 \
  --prefix "" \
  --tags "cache=true" 2>/dev/null || true

# --- Bucket policies ---
echo "==> Setting bucket policies..."

# Media: private (only authenticated access)
mc anonymous set none "${ALIAS}/vialum-media"
mc anonymous set none "${ALIAS}/vialum-classifications"
mc anonymous set none "${ALIAS}/vialum-portal"
mc anonymous set none "${ALIAS}/vialum-backups"

# --- Service accounts (one per service, least privilege) ---
echo "==> Creating service accounts..."

# Media Service account
mc admin user add "${ALIAS}" media-service "$(openssl rand -hex 16)" 2>/dev/null || true

# Classification Hub account
mc admin user add "${ALIAS}" classification-hub "$(openssl rand -hex 16)" 2>/dev/null || true

# Portal Engine account
mc admin user add "${ALIAS}" portal-engine "$(openssl rand -hex 16)" 2>/dev/null || true

echo ""
echo "==> Done. Buckets ready:"
mc ls "${ALIAS}/"
echo ""
echo "Console: http://localhost:9001"
echo "API:     http://localhost:9000"
