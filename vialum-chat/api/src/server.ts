import 'dotenv/config';
import { loadEnv } from './config/env.js';
import { getPrisma, disconnectPrisma } from './config/database.js';
import { disconnectRedis } from './config/redis.js';
import { buildApp } from './app.js';
import { initializeWorkers, shutdownWorkers } from './workers/index.js';

async function main() {
  const env = loadEnv();

  // Wait for database
  const prisma = getPrisma();
  let retries = 10;
  while (retries > 0) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      break;
    } catch (err) {
      retries--;
      if (retries === 0) {
        console.error('Failed to connect to database after 10 retries');
        process.exit(1);
      }
      console.log(`Waiting for database... (${retries} retries left)`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Vialum Chat API running on port ${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Initialize BullMQ workers
  const workerRegistry = await initializeWorkers((app as any).io);

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info('Shutting down...');
    await shutdownWorkers(workerRegistry);
    await app.close();
    await disconnectPrisma();
    await disconnectRedis();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main();
