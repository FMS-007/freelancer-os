import 'dotenv/config';
import app from './app';
import { redis } from './lib/redis';
import prisma from './lib/prisma';
import { startExpiryJob } from './jobs/expiry';
import { startAlertJobs } from './jobs/alerts';

const PORT = process.env.PORT || 3001;

async function main() {
  try {
    // Connect to Redis (lazy connect)
    await redis.connect();

    // Test DB connection
    await prisma.$connect();
    console.log('[DB] Connected to PostgreSQL');

    // Start cron jobs
    startExpiryJob();
    startAlertJobs();

    app.listen(PORT, () => {
      console.log(`[API] Server running at http://localhost:${PORT}`);
      console.log(`[API] Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('[Startup] Failed:', err);
    process.exit(1);
  }
}

main();

process.on('SIGTERM', async () => {
  console.log('[API] Shutting down gracefully...');
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});
