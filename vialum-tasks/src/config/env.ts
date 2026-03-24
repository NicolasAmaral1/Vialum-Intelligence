import dotenv from 'dotenv';
dotenv.config();

const REQUIRED_VARS = ['DATABASE_URL', 'JWT_SECRET', 'WEBHOOK_SECRET'] as const;
for (const key of REQUIRED_VARS) {
  if (!process.env[key]) {
    console.error(`FATAL: ${key} is required but not set`);
    process.exit(1);
  }
}

export const env = {
  PORT: parseInt(process.env.PORT ?? '3005', 10),
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET!,
  HUB_SERVICE_URL: process.env.HUB_SERVICE_URL ?? 'http://vialum-crm-hub:3100',
  CHAT_SERVICE_URL: process.env.CHAT_SERVICE_URL ?? 'http://vialumchat-api:4000',
  MEDIA_SERVICE_URL: process.env.MEDIA_SERVICE_URL ?? 'http://vialum-media:3002',
  SWITCH_SERVICE_URL: process.env.SWITCH_SERVICE_URL ?? 'http://vialum-switch:3004',
  MAX_CONCURRENT_SESSIONS: parseInt(process.env.MAX_CONCURRENT_SESSIONS ?? '3', 10),
  SESSION_TIMEOUT_MS: parseInt(process.env.SESSION_TIMEOUT_MS ?? '1800000', 10), // 30 min
  WORKSPACE_PATH: process.env.WORKSPACE_PATH ?? '/root/genesis',
  REDIS_URL: process.env.REDIS_URL ?? '',
};
