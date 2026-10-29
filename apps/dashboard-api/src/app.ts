import rateLimit from '@fastify/rate-limit';
import type { Db } from '@aynalytics/core';
import { SqliteAnalyticsRepository, SqliteEventRepository, SqliteSiteRepository } from '@aynalytics/core';
import Fastify from 'fastify';
import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import { GetOverview } from './application/analytics/usecases/GetOverview';
import { GetGroupedStats } from './application/analytics/usecases/GetGroupedStats';
import { GetPropertyBreakdown } from './application/analytics/usecases/GetPropertyBreakdown';
import { GetPropertyKeys } from './application/analytics/usecases/GetPropertyKeys';
import { GetSitesBreakdown } from './application/analytics/usecases/GetSitesBreakdown';
import { GetTimeseries } from './application/analytics/usecases/GetTimeseries';
import { GetTimeseriesBySite } from './application/analytics/usecases/GetTimeseriesBySite';
import { GetTopValues } from './application/analytics/usecases/GetTopValues';
import { ListEvents } from './application/analytics/usecases/ListEvents';
import { CreateSite } from './application/sites/usecases/CreateSite';
import { DeleteSite } from './application/sites/usecases/DeleteSite';
import { ListSites } from './application/sites/usecases/ListSites';
import { RotateSiteSecret } from './application/sites/usecases/RotateSiteSecret';
import { UpdateSite } from './application/sites/usecases/UpdateSite';
import { registerSecurity } from './presentation/plugins/security';
import { analyticsRoutes } from './presentation/routes/analytics';
import { siteRoutes } from './presentation/routes/sites';
import { webRoutes } from './presentation/routes/web';

export interface DashboardOptions {
  db: Db;
  auth: { user: string; password: string };
  collectorUrl?: string;
  webDist?: string;
  logger: FastifyServerOptions['logger'];
}

export async function buildDashboard(options: DashboardOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger, bodyLimit: 32 * 1024 });

  const sites = new SqliteSiteRepository(options.db);
  const events = new SqliteEventRepository(options.db);
  const analytics = new SqliteAnalyticsRepository(options.db);

  await app.register(rateLimit, { max: 600, timeWindow: '1 minute' });
  registerSecurity(app, options.auth);

  app.get('/api/health', async () => ({ status: 'ok' }));
  app.get('/api/config', async () => ({ collectorUrl: options.collectorUrl ?? null }));

  siteRoutes(app, {
    listSites: new ListSites(sites),
    createSite: new CreateSite(sites),
    updateSite: new UpdateSite(sites),
    rotateSiteSecret: new RotateSiteSecret(sites),
    deleteSite: new DeleteSite(sites, events),
  });
  analyticsRoutes(app, {
    getOverview: new GetOverview(analytics),
    getTimeseries: new GetTimeseries(analytics),
    getSitesBreakdown: new GetSitesBreakdown(analytics),
    getTimeseriesBySite: new GetTimeseriesBySite(analytics),
    getTopValues: new GetTopValues(analytics),
    getPropertyKeys: new GetPropertyKeys(analytics),
    getPropertyBreakdown: new GetPropertyBreakdown(analytics),
    getGroupedStats: new GetGroupedStats(analytics),
    listEvents: new ListEvents(analytics),
  });
  await webRoutes(app, options.webDist);

  return app;
}
