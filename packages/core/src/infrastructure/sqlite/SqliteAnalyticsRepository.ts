import type {
  Dimension,
  EventListQuery,
  GroupField,
  GroupQuery,
  GroupRow,
  Interval,
  Overview,
  PropertyBreakdown,
  PropertyKeyRow,
  SiteOverview,
  SiteTimeseries,
  StatsFilter,
  TimeseriesPoint,
  TopRow,
} from '../../domain/analytics/entities/Stats';
import { DIMENSIONS, INTERVAL_MS } from '../../domain/analytics/entities/Stats';
import type { AnalyticsRepository } from '../../domain/analytics/repositories/AnalyticsRepository';
import type { EventType, JsonValue, StoredEvent } from '../../domain/events/entities/TrackedEvent';
import type { Db } from './database';

type Params = Record<string, string | number>;

interface EventRow {
  id: number;
  site_id: string;
  type: EventType;
  name: string;
  properties: string;
  ts: number;
  received_at: number;
  visitor_hash: string;
  session_id: string | null;
  anonymous_id: string | null;
  user_id: string | null;
  url: string | null;
  path: string | null;
  referrer: string | null;
  referrer_host: string | null;
  source: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  language: string | null;
  screen_width: number | null;
  title: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
  screen_height: number | null;
  viewport_width: number | null;
  viewport_height: number | null;
  pixel_ratio: number | null;
  color_scheme: string | null;
  connection: string | null;
  context: string;
}

const toStoredEvent = (r: EventRow): StoredEvent => ({
  id: r.id,
  siteId: r.site_id,
  type: r.type,
  name: r.name,
  properties: JSON.parse(r.properties) as Record<string, JsonValue>,
  ts: r.ts,
  receivedAt: r.received_at,
  visitorHash: r.visitor_hash,
  sessionId: r.session_id,
  anonymousId: r.anonymous_id,
  userId: r.user_id,
  url: r.url,
  path: r.path,
  referrer: r.referrer,
  referrerHost: r.referrer_host,
  source: r.source,
  utm: {
    source: r.utm_source,
    medium: r.utm_medium,
    campaign: r.utm_campaign,
    term: r.utm_term,
    content: r.utm_content,
  },
  browser: r.browser,
  os: r.os,
  device: r.device,
  language: r.language,
  screenWidth: r.screen_width,
  title: r.title,
  country: r.country,
  region: r.region,
  city: r.city,
  timezone: r.timezone,
  screenHeight: r.screen_height,
  viewportWidth: r.viewport_width,
  viewportHeight: r.viewport_height,
  pixelRatio: r.pixel_ratio,
  colorScheme: r.color_scheme,
  connection: r.connection,
  context: JSON.parse(r.context) as Record<string, JsonValue>,
});

/** Construit le WHERE commun. Toutes les valeurs passent en parametres nommes (aucune concatenation d'entree). */
function buildWhere(filter: StatsFilter): { sql: string; params: Params } {
  const clauses = ['e.ts >= @from', 'e.ts < @to'];
  const params: Params = { from: filter.from, to: filter.to };
  const optional: [keyof StatsFilter, string][] = [
    ['siteId', 'e.site_id'],
    ['type', 'e.type'],
    ['name', 'e.name'],
    ['source', 'e.source'],
    ['path', 'e.path'],
  ];
  for (const [key, column] of optional) {
    const value = filter[key];
    if (value !== undefined && value !== '') {
      clauses.push(`${column} = @${key}`);
      params[key] = value;
    }
  }
  return { sql: clauses.join(' AND '), params };
}

/**
 * Visiteur unique : identifiant anonyme persistant du SDK (persistence 'local') s'il existe,
 * sinon hash journalier IP+UA.
 */
const VISITOR_KEY = 'COALESCE(e.anonymous_id, e.visitor_hash)';

/** Buckets de `size` ms alignes sur le fuseau du lecteur, de `from` a `to` (exclu). */
function buckets(filter: StatsFilter, size: number, offset: number): number[] {
  const result: number[] = [];
  const start = Math.floor((filter.from + offset) / size) * size - offset;
  for (let bucket = start; bucket < filter.to; bucket += size) result.push(bucket);
  return result;
}

const JSON_VALUE_AS_TEXT = `CASE je.type
  WHEN 'true' THEN 'true'
  WHEN 'false' THEN 'false'
  WHEN 'null' THEN 'null'
  ELSE CAST(je.value AS TEXT) END`;

/** Expression SQL d'un champ de regroupement ; la cle de propriete passe en parametre `@p<i>`. */
function groupExpression(field: GroupField, index: number): string {
  const expression =
    'dimension' in field
      ? DIMENSIONS[field.dimension]
      : `(SELECT ${JSON_VALUE_AS_TEXT} FROM json_each(e.properties) je WHERE je.key = @p${index})`;
  return `COALESCE(${expression}, '(aucun)')`;
}

type Row = Record<string, string | number>;

export class SqliteAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly db: Db) {}

  overview(filter: StatsFilter): Overview {
    const { sql, params } = buildWhere(filter);
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(e.type = 'screen'), 0) AS screens,
                COALESCE(SUM(e.type = 'event'), 0) AS events,
                COUNT(DISTINCT ${VISITOR_KEY}) AS visitors,
                COUNT(DISTINCT e.session_id) AS sessions
         FROM events e WHERE ${sql}`,
      )
      .get(params) as Overview;
    return row;
  }

  timeseries(filter: StatsFilter, interval: Interval, tzOffsetMinutes: number): TimeseriesPoint[] {
    // better-sqlite3 lie les nombres JS en REAL : sans CAST, la division ne tronque pas et aucun
    // evenement ne tombe sur une borne de bucket.
    const size = INTERVAL_MS[interval];
    const offset = tzOffsetMinutes * 60_000;
    const { sql, params } = buildWhere(filter);
    const rows = this.db
      .prepare(
        `SELECT CAST((e.ts + @offset) / @size AS INTEGER) * @size - @offset AS bucket,
                COUNT(*) AS count,
                COUNT(DISTINCT ${VISITOR_KEY}) AS visitors
         FROM events e WHERE ${sql}
         GROUP BY bucket ORDER BY bucket`,
      )
      .all({ ...params, offset, size }) as TimeseriesPoint[];
    const byBucket = new Map(rows.map((r) => [r.bucket, r]));
    return buckets(filter, size, offset).map(
      (bucket) => byBucket.get(bucket) ?? { bucket, count: 0, visitors: 0 },
    );
  }

  overviewBySite(filter: StatsFilter): SiteOverview[] {
    const { sql, params } = buildWhere(filter);
    return this.db
      .prepare(
        `SELECT e.site_id AS siteId,
                COUNT(*) AS total,
                COALESCE(SUM(e.type = 'screen'), 0) AS screens,
                COALESCE(SUM(e.type = 'event'), 0) AS events,
                COUNT(DISTINCT ${VISITOR_KEY}) AS visitors,
                COUNT(DISTINCT e.session_id) AS sessions
         FROM events e WHERE ${sql}
         GROUP BY e.site_id ORDER BY visitors DESC, total DESC, siteId ASC`,
      )
      .all(params) as SiteOverview[];
  }

  timeseriesBySite(filter: StatsFilter, interval: Interval, tzOffsetMinutes: number): SiteTimeseries[] {
    const size = INTERVAL_MS[interval];
    const offset = tzOffsetMinutes * 60_000;
    const { sql, params } = buildWhere(filter);
    const rows = this.db
      .prepare(
        `SELECT e.site_id AS siteId,
                CAST((e.ts + @offset) / @size AS INTEGER) * @size - @offset AS bucket,
                COUNT(*) AS count,
                COUNT(DISTINCT ${VISITOR_KEY}) AS visitors
         FROM events e WHERE ${sql}
         GROUP BY e.site_id, bucket`,
      )
      .all({ ...params, offset, size }) as (TimeseriesPoint & { siteId: string })[];
    const bySite = new Map<string, Map<number, TimeseriesPoint>>();
    for (const { siteId, ...point } of rows) {
      const points = bySite.get(siteId) ?? new Map<number, TimeseriesPoint>();
      points.set(point.bucket, point);
      bySite.set(siteId, points);
    }
    const all = buckets(filter, size, offset);
    return [...bySite.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([siteId, points]) => ({
        siteId,
        points: all.map((bucket) => points.get(bucket) ?? { bucket, count: 0, visitors: 0 }),
      }));
  }

  top(filter: StatsFilter, dimension: Dimension, limit: number): TopRow[] {
    const expression = DIMENSIONS[dimension];
    const { sql, params } = buildWhere(filter);
    return this.db
      .prepare(
        `SELECT COALESCE(${expression}, '(aucun)') AS value,
                COUNT(*) AS count,
                COUNT(DISTINCT ${VISITOR_KEY}) AS visitors
         FROM events e WHERE ${sql}
         GROUP BY value ORDER BY count DESC, value ASC LIMIT @limit`,
      )
      .all({ ...params, limit }) as TopRow[];
  }

  propertyKeys(filter: StatsFilter): PropertyKeyRow[] {
    const { sql, params } = buildWhere(filter);
    return this.db
      .prepare(
        `SELECT je.key AS key, COUNT(*) AS count
         FROM events e, json_each(e.properties) je
         WHERE ${sql}
         GROUP BY je.key ORDER BY count DESC, key ASC LIMIT 200`,
      )
      .all(params) as PropertyKeyRow[];
  }

  propertyBreakdown(filter: StatsFilter, key: string, limit: number): PropertyBreakdown {
    const { sql, params } = buildWhere(filter);
    const rows = this.db
      .prepare(
        `SELECT ${JSON_VALUE_AS_TEXT} AS value,
                COUNT(*) AS count,
                COUNT(DISTINCT ${VISITOR_KEY}) AS visitors
         FROM events e, json_each(e.properties) je
         WHERE ${sql} AND je.key = @key
         GROUP BY value ORDER BY count DESC, value ASC LIMIT @limit`,
      )
      .all({ ...params, key, limit }) as TopRow[];
    const numeric = this.db
      .prepare(
        `SELECT COUNT(*) AS count, SUM(je.value) AS sum, AVG(je.value) AS avg,
                MIN(je.value) AS min, MAX(je.value) AS max
         FROM events e, json_each(e.properties) je
         WHERE ${sql} AND je.key = @key AND je.type IN ('integer', 'real')`,
      )
      .get({ ...params, key }) as { count: number; sum: number; avg: number; min: number; max: number };
    return { rows, numeric: numeric.count > 0 ? numeric : null };
  }

  groupBy(filter: StatsFilter, query: GroupQuery): GroupRow[] {
    const { sql, params } = buildWhere(filter);
    const size = INTERVAL_MS[query.interval];
    const offset = query.tzOffsetMinutes * 60_000;
    const columns = query.fields.map((_, i) => `g${i}`);
    const list = columns.join(', ');
    const all: Params = { ...params, limit: query.limit, offset, size };
    query.fields.forEach((field, i) => {
      if ('property' in field) all[`p${i}`] = field.property;
    });
    // `base` calcule une fois les valeurs de groupe ; `top` fixe les groupes retenus (ordre
    // deterministe) pour que la serie temporelle porte exactement sur les memes.
    const cte = `WITH base AS (
        SELECT ${query.fields.map((f, i) => `${groupExpression(f, i)} AS g${i}`).join(', ')},
               e.ts AS ts, ${VISITOR_KEY} AS v
        FROM events e WHERE ${sql}),
      top AS (
        SELECT ${list}, COUNT(*) AS count, COUNT(DISTINCT v) AS visitors,
               MIN(ts) AS firstTs, MAX(ts) AS lastTs
        FROM base GROUP BY ${list}
        ORDER BY visitors DESC, count DESC, ${list} LIMIT @limit)`;
    const groups = this.db
      .prepare(`${cte} SELECT * FROM top ORDER BY visitors DESC, count DESC, ${list}`)
      .all(all) as Row[];
    const points = this.db
      .prepare(
        `${cte} SELECT ${columns.map((c) => `b.${c} AS ${c}`).join(', ')},
                CAST((b.ts + @offset) / @size AS INTEGER) * @size - @offset AS bucket,
                COUNT(*) AS count, COUNT(DISTINCT b.v) AS visitors
         FROM base b JOIN top t ON ${columns.map((c) => `b.${c} = t.${c}`).join(' AND ')}
         GROUP BY ${columns.map((c) => `b.${c}`).join(', ')}, bucket`,
      )
      .all(all) as Row[];

    const keyOf = (row: Row) => JSON.stringify(columns.map((c) => row[c]));
    const byGroup = new Map<string, Map<number, TimeseriesPoint>>();
    for (const row of points) {
      const series = byGroup.get(keyOf(row)) ?? new Map<number, TimeseriesPoint>();
      const bucket = Number(row.bucket);
      series.set(bucket, { bucket, count: Number(row.count), visitors: Number(row.visitors) });
      byGroup.set(keyOf(row), series);
    }
    const allBuckets = buckets(filter, size, offset);
    return groups.map((row) => {
      const series = byGroup.get(keyOf(row));
      return {
        values: columns.map((c) => String(row[c])),
        count: Number(row.count),
        visitors: Number(row.visitors),
        firstTs: Number(row.firstTs),
        lastTs: Number(row.lastTs),
        points: allBuckets.map((bucket) => series?.get(bucket) ?? { bucket, count: 0, visitors: 0 }),
      };
    });
  }

  listEvents(filter: StatsFilter, query: EventListQuery): StoredEvent[] {
    const where = buildWhere(filter);
    const clauses = [where.sql];
    const params: Params = { ...where.params, limit: query.limit };
    if (query.before !== undefined) {
      clauses.push('e.id < @before');
      params.before = query.before;
    }
    if (query.propKey) {
      params.propKey = query.propKey;
      if (query.propValue !== undefined) {
        params.propValue = query.propValue;
        clauses.push(
          `EXISTS (SELECT 1 FROM json_each(e.properties) je WHERE je.key = @propKey AND ${JSON_VALUE_AS_TEXT} = @propValue)`,
        );
      } else {
        clauses.push('EXISTS (SELECT 1 FROM json_each(e.properties) je WHERE je.key = @propKey)');
      }
    }
    const rows = this.db
      .prepare(`SELECT e.* FROM events e WHERE ${clauses.join(' AND ')} ORDER BY e.id DESC LIMIT @limit`)
      .all(params) as EventRow[];
    return rows.map(toStoredEvent);
  }
}
