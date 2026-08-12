// Server entry point: connects to MongoDB, starts the Express API, runs a periodic
// background sweep that expires stale matches, and shuts everything down cleanly.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { connectToDb, disconnectFromDb } from './config/db';
import { router } from './routes';
import { expireStaleMatches } from './services/matches';

const PORT = parseInt(process.env.PORT ?? '5000', 10);

async function start() {
  await connectToDb();

  // Sweep matches whose window has passed into 'expired' so they stop blocking the
  // candidate pool (the matcher also guards on expiresAt directly; this keeps the
  // status-based reads consistent too). Runs on boot, then every 2 minutes.
  const EXPIRE_SWEEP_MS = 2 * 60 * 1000;
  const runExpirySweep = async () => {
    try {
      const n = await expireStaleMatches();
      if (n > 0) console.log(`[sweep] expired ${n} stale match(es)`);
    } catch (e) {
      console.warn('[sweep] expireStaleMatches failed:', (e as Error).message);
    }
  };
  await runExpirySweep();
  const sweepTimer = setInterval(runExpirySweep, EXPIRE_SWEEP_MS);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '6mb' }));

  app.use('/api', router);

  // Global 404
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  const server = app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
    console.log(`[server] try GET http://localhost:${PORT}/api/health`);
  });

  // Graceful shutdown on Ctrl+C / SIGTERM
  const shutdown = async (signal: string) => {
    console.log(`\n[server] received ${signal}, shutting down…`);
    clearInterval(sweepTimer);
    server.close(async () => {
      await disconnectFromDb();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('[server] failed to start', err);
  process.exit(1);
});