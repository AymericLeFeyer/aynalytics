import { join } from 'node:path';
import { databasePath, openDatabase, SqliteEventRepository, SqliteSaltRepository } from '@aynalytics/core';
import { buildCollector } from './app';
import { PurgeExpiredData } from './application/maintenance/usecases/PurgeExpiredData';
import { loadEnv, parseTrustProxy } from './config/env';
import { DbIpDownloader } from './infrastructure/geo/DbIpDownloader';
import { MmdbGeoLocator } from './infrastructure/geo/MmdbGeoLocator';

const env = loadEnv();
const db = openDatabase(databasePath(env.DATA_DIR));
const geo = env.GEOIP === 'off' ? null : new MmdbGeoLocator();

const app = await buildCollector({
  db,
  sdkDir: env.SDK_DIR,
  rateLimitPerMinute: env.RATE_LIMIT_PER_MINUTE,
  trustProxy: parseTrustProxy(env.TRUST_PROXY),
  logger: { level: env.LOG_LEVEL },
  geo,
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

// Base de geolocalisation : telechargee en arriere-plan (le collector repond sans attendre),
// verifiee chaque jour, rechargee a chaud quand une nouvelle version arrive.
if (geo && env.GEOIP !== 'off') {
  const downloader = new DbIpDownloader(join(env.DATA_DIR, 'geo'), env.GEOIP);
  const refreshGeo = async () => {
    try {
      const result = await downloader.ensureFresh();
      if (!result) return app.log.warn('base de geolocalisation indisponible : collecte sans localisation');
      if (result.updated || !geo.loaded) {
        await geo.load(result.path);
        app.log.info({ edition: env.GEOIP, updated: result.updated }, 'base de geolocalisation chargee');
      }
    } catch (err) {
      app.log.error(err, 'chargement de la base de geolocalisation en echec');
    }
  };
  void refreshGeo();
  setInterval(() => void refreshGeo(), 24 * 60 * 60_000).unref();
}

const shutdown = async () => {
  await app.close();
  db.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ port: env.PORT, host: env.HOST });
