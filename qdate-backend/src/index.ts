import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { connectToDb, disconnectFromDb } from './config/db';
import { router } from './routes';

const PORT = parseInt(process.env.PORT ?? '5000', 10);

async function start() {
  await connectToDb();

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