import rateLimit from '@fastify/rate-limit';
import type { Db } from '@aynalytics/core';
import { SqliteEventRepository, SqliteSaltRepository, SqliteSiteRepository } from '@aynalytics/core';
import Fastify from 'fastify';
import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import { AuthorizeCollect } from './application/ingest/usecases/AuthorizeCollect';
import { IngestEvents } from './application/ingest/usecases/IngestEvents';
import { SiteRegistry } from './application/sites/SiteRegistry';
import { registerSecurity } from './presentation/plugins/security';
import { collectRoutes } from './presentation/routes/collect';
import { sdkRoutes } from './presentation/routes/sdk';

export interface CollectorOptions {
  db: Db;
  sdkDir?: string;
  rateLimitPerMinute: number;
  trustProxy: FastifyServerOptions['trustProxy'];
  logger: FastifyServerOptions['logger'];
  registryTtlMs?: number;
}

export async function buildCollector(options: CollectorOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger,
    trustProxy: options.trustProxy,
    bodyLimit: 64 * 1024,
  });

  const registry = new SiteRegistry(new SqliteSiteRepository(options.db), options.registryTtlMs);
  const ingest = new IngestEvents(
    new SqliteEventRepository(options.db),
    new SqliteSaltRepository(options.db),
  );
  const authorize = new AuthorizeCollect(registry);

  // sendBeacon / fetch "simple" envoient du text/plain : on le parse en JSON (parseur securise de Fastify).
  app.removeContentTypeParser('text/plain');
  app.addContentTypeParser('text/plain', { parseAs: 'string' }, app.getDefaultJsonParser('error', 'error'));

  await app.register(rateLimit, { global: false });
  registerSecurity(app, registry);

  app.get('/health', async () => ({ status: 'ok' }));
  sdkRoutes(app, options.sdkDir);
  collectRoutes(app, { registry, authorize, ingest, rateLimitPerMinute: options.rateLimitPerMinute });

  return app;
}
