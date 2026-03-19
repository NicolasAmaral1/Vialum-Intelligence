import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  CRM_HUB_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env;

export function loadEnv(): Env {
  if (_env) return _env;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  _env = parsed.data;
  return _env;
}

export function getEnv(): Env {
  if (!_env) return loadEnv();
  return _env;
}
