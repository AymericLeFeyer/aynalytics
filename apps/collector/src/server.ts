import { databasePath, openDatabase, SqliteEventRepository, SqliteSaltRepository } from '@aynalytics/core';
import { buildCollector } from './app';
import { PurgeExpiredData } from './application/maintenance/usecases/PurgeExpiredData';
import { loadEnv, parseTrustProxy } from './config/env';

const env = loadEnv();
const db = openDatabase(databasePath(env.DATA_DIR));

const app = await buildCollector({
  db,
  sdkDir: env.SDK_DIR,
  rateLimitPerMinute: env.RATE_LIMIT_PER_MINUTE,
  trustProxy: parseTrustProxy(env.TRUST_PROXY),
  logger: { level: env.LOG_LEVEL },
});

const purge = new PurgeExpiredData(
  new SqliteEventRepository(db),
  new SqliteSaltRepository(db),
  env.RETENTION_DAYS,
);
const runPurge = () => {
  try {
    const { purgedEvents } = purge.execute();
    if (purgedEvents) app.log.info({ purgedEvents }, 'retention appliquee');
  } catch (err) {
    app.log.error(err, 'purge en echec');
  }
};
runPurge();
setInterval(runPurge, 60 * 60_000).unref();

const shutdown = async () => {
  await app.close();
  db.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ port: env.PORT, host: env.HOST });
