import { databasePath, openDatabase } from '@aynalytics/core';
import { buildDashboard } from './app';
import { loadEnv } from './config/env';

const env = loadEnv();
const db = openDatabase(databasePath(env.DATA_DIR));

const app = await buildDashboard({
  db,
  auth: { user: env.BASIC_AUTH_USER, password: env.BASIC_AUTH_PASSWORD },
  collectorUrl: env.COLLECTOR_PUBLIC_URL,
  webDist: env.WEB_DIST,
  logger: { level: env.LOG_LEVEL },
});

const shutdown = async () => {
  await app.close();
  db.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ port: env.PORT, host: env.HOST });
