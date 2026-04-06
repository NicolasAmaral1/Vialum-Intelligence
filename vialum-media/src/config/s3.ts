// ════════════════════════════════════════════════════════════
// S3 Client — Works with MinIO (local) and AWS S3 (production)
// Change only env vars to migrate: zero code changes.
// ════════════════════════════════════════════════════════════

import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env.js';

let client: S3Client | null = null;
let publicClient: S3Client | null = null;

/** Internal S3 client for uploads/downloads (uses Docker-internal endpoint) */
export function getS3(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });
  }
  return client;
}

/** Public S3 client for presigned URLs (uses public-facing endpoint so browsers can access) */
export function getS3Public(): S3Client {
  if (!publicClient) {
    const publicEndpoint = env.S3_PUBLIC_URL || env.S3_ENDPOINT;
    publicClient = new S3Client({
      endpoint: publicEndpoint,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });
  }
  return publicClient;
}
