import dotenv from 'dotenv';
dotenv.config();

// Validate required env vars at startup
const REQUIRED_VARS = ['DATABASE_URL', 'JWT_SECRET', 'WEBHOOK_SECRET'] as const;
for (const key of REQUIRED_VARS) {
  if (!process.env[key]) {
    console.error(`FATAL: ${key} is required but not set`);
    process.exit(1);
  }
}

export const env = {
  PORT: parseInt(process.env.PORT ?? '3004', 10),
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',
  MEDIA_SERVICE_URL: process.env.MEDIA_SERVICE_URL ?? 'http://vialum-media:3002',
  TRANSCRIBER_URL: process.env.TRANSCRIBER_URL ?? 'http://transcriber-api:8000',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? '',
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET!,
};
