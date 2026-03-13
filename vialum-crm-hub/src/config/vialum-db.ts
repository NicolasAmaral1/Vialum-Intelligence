import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

/**
 * Connection pool to the Vialum Chat database (cross-database query).
 * Uses the same PostgreSQL host but different database name.
 * Falls back gracefully if VIALUM_DATABASE_URL is not set.
 */
export function getVialumPool(): pg.Pool {
  if (!pool) {
    const url = process.env.VIALUM_DATABASE_URL;
    if (!url) {
      throw new Error('VIALUM_DATABASE_URL not configured — cannot query Vialum Chat data');
    }
    pool = new Pool({ connectionString: url, max: 5 });
  }
  return pool;
}

export async function disconnectVialumPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
