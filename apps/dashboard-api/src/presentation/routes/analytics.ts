import type { Dimension, GroupField, StatsFilter } from '@aynalytics/core';
import { DIMENSION_KEYS, DomainError, MAX_GROUP_FIELDS } from '@aynalytics/core';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { GetGroupedStats } from '../../application/analytics/usecases/GetGroupedStats';
import type { GetOverview } from '../../application/analytics/usecases/GetOverview';
import type { GetPropertyBreakdown } from '../../application/analytics/usecases/GetPropertyBreakdown';
import type { GetPropertyKeys } from '../../application/analytics/usecases/GetPropertyKeys';
import type { GetSitesBreakdown } from '../../application/analytics/usecases/GetSitesBreakdown';
import type { GetTimeseries } from '../../application/analytics/usecases/GetTimeseries';
import type { GetTimeseriesBySite } from '../../application/analytics/usecases/GetTimeseriesBySite';
import type { GetTopValues } from '../../application/analytics/usecases/GetTopValues';
import type { ListEvents } from '../../application/analytics/usecases/ListEvents';

export interface AnalyticsUseCases {
  getOverview: GetOverview;
  getTimeseries: GetTimeseries;
  getSitesBreakdown: GetSitesBreakdown;
  getTimeseriesBySite: GetTimeseriesBySite;
  getTopValues: GetTopValues;
  getPropertyKeys: GetPropertyKeys;
  getPropertyBreakdown: GetPropertyBreakdown;
  getGroupedStats: GetGroupedStats;
  listEvents: ListEvents;
}

const MAX_RANGE_MS = 2 * 366 * 86_400_000;

const filterShape = {
  siteId: z.string().max(64).optional(),
  from: z.coerce.number().int().nonnegative(),
  to: z.coerce.number().int().positive(),
  type: z.enum(['screen', 'event']).optional(),
  name: z.string().max(100).optional(),
  source: z.string().max(200).optional(),
  path: z.string().max(2048).optional(),
};
const limit = (max: number, fallback: number) => z.coerce.number().int().min(1).max(max).default(fallback);

const filterQuery = z.object(filterShape);
const timeseriesQuery = z.object({
  ...filterShape,
  interval: z.enum(['hour', 'day']).default('day'),
  tz: z.coerce.number().int().min(-840).max(840).default(0),
});
const topQuery = z.object({
  ...filterShape,
  dimension: z.enum(DIMENSION_KEYS as [string, ...string[]]),
  limit: limit(100, 10),
});
const breakdownQuery = z.object({ ...filterShape, key: z.string().min(1).max(64), limit: limit(200, 50) });
/** `fields` : liste separee par des virgules de dimensions ou `prop:<cle>` (cle URL-encodee). */
const groupField = z.string().transform((raw, ctx): GroupField => {
  if (raw.startsWith('prop:')) {
    let property = '';
    try {
      property = decodeURIComponent(raw.slice(5));
    } catch {
      // encodage invalide : rejete ci-dessous
    }
    if (property.length >= 1 && property.length <= 64) return { property };
  } else if ((DIMENSION_KEYS as string[]).includes(raw)) {
    return { dimension: raw as Dimension };
  }
  ctx.addIssue({ code: 'custom', message: `Champ de regroupement invalide : ${raw}` });
  return z.NEVER;
});
const groupsQuery = z.object({
  ...timeseriesQuery.shape,
  fields: z
    .string()
    .max(1000)
    .transform((raw) => raw.split(','))
    .pipe(z.array(groupField).min(1).max(MAX_GROUP_FIELDS)),
  limit: limit(100, 50),
});
const eventsQuery = z.object({
  ...filterShape,
  limit: limit(200, 50),
  before: z.coerce.number().int().positive().optional(),
  propKey: z.string().max(64).optional(),
  propValue: z.string().max(1000).optional(),
});

function toFilter<T extends z.infer<typeof filterQuery>>(query: T): StatsFilter {
  if (query.to <= query.from || query.to - query.from > MAX_RANGE_MS)
    throw new DomainError('Période invalide');
  const { siteId, from, to, type, name, source, path } = query;
  return { siteId, from, to, type, name, source, path };
}

export function analyticsRoutes(app: FastifyInstance, useCases: AnalyticsUseCases): void {
  app.get('/api/stats/overview', async (request) =>
    useCases.getOverview.execute(toFilter(filterQuery.parse(request.query))),
  );

  app.get('/api/stats/timeseries', async (request) => {
    const query = timeseriesQuery.parse(request.query);
    return useCases.getTimeseries.execute(toFilter(query), query.interval, query.tz);
  });

  app.get('/api/stats/sites', async (request) =>
    useCases.getSitesBreakdown.execute(toFilter(filterQuery.parse(request.query))),
  );

  app.get('/api/stats/timeseries/sites', async (request) => {
    const query = timeseriesQuery.parse(request.query);
    return useCases.getTimeseriesBySite.execute(toFilter(query), query.interval, query.tz);
  });

  app.get('/api/stats/top', async (request) => {
    const query = topQuery.parse(request.query);
    return useCases.getTopValues.execute(
      toFilter(query),
      query.dimension as (typeof DIMENSION_KEYS)[number],
      query.limit,
    );
  });

  app.get('/api/stats/properties', async (request) =>
    useCases.getPropertyKeys.execute(toFilter(filterQuery.parse(request.query))),
  );

  app.get('/api/stats/breakdown', async (request) => {
    const query = breakdownQuery.parse(request.query);
    return useCases.getPropertyBreakdown.execute(toFilter(query), query.key, query.limit);
  });

  app.get('/api/stats/groups', async (request) => {
    const query = groupsQuery.parse(request.query);
    return useCases.getGroupedStats.execute(toFilter(query), {
      fields: query.fields,
      limit: query.limit,
      interval: query.interval,
      tzOffsetMinutes: query.tz,
    });
  });

  app.get('/api/events', async (request) => {
    const query = eventsQuery.parse(request.query);
    return useCases.listEvents.execute(toFilter(query), {
      limit: query.limit,
      before: query.before,
      propKey: query.propKey,
      propValue: query.propValue,
    });
  });
}
