import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT ?? '3002', 10),
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  JWT_SECRET: process.env.JWT_SECRET ?? '',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',
  // S3-compatible storage (MinIO or AWS)
  S3_ENDPOINT: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ?? '',
  S3_SECRET_KEY: process.env.S3_SECRET_KEY ?? '',
  S3_REGION: process.env.S3_REGION ?? 'us-east-1',
  S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE === 'true',
  S3_BUCKET: process.env.S3_BUCKET ?? 'vialum-media',
};

const required = ['DATABASE_URL', 'JWT_SECRET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'] as const;
for (const key of required) {
  if (!env[key]) {
    console.warn(`Warning: Missing environment variable: ${key}`);
  }
}
