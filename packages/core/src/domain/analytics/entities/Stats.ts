import type { EventType } from '../../events/entities/TrackedEvent';

export interface StatsFilter {
  /** Absent = tous les sites. */
  siteId?: string;
  from: number;
  to: number;
  type?: EventType;
  name?: string;
  source?: string;
  path?: string;
}

export interface Overview {
  total: number;
  screens: number;
  events: number;
  visitors: number;
  sessions: number;
}

export type Interval = 'hour' | 'day';
export const INTERVAL_MS: Record<Interval, number> = { hour: 3_600_000, day: 86_400_000 };

export interface TimeseriesPoint {
  bucket: number;
  count: number;
  visitors: number;
}

/**
 * Dimensions groupables -> expression SQL (alias `e`). Whitelist : l'expression vient
 * exclusivement de cette table, jamais de l'entree utilisateur.
 */
export const DIMENSIONS = {
  name: 'e.name',
  path: 'e.path',
  title: 'e.title',
  source: 'e.source',
  referrer: 'e.referrer_host',
  utm_source: 'e.utm_source',
  utm_medium: 'e.utm_medium',
  utm_campaign: 'e.utm_campaign',
  browser: 'e.browser',
  os: 'e.os',
  device: 'e.device',
  language: 'e.language',
  country: 'e.country',
  region: 'e.region',
  city: 'e.city',
  timezone: 'e.timezone',
  screen:
    "CASE WHEN e.screen_width IS NULL THEN NULL ELSE e.screen_width || 'x' || COALESCE(e.screen_height, '?') END",
  color_scheme: 'e.color_scheme',
  connection: 'e.connection',
} as const;
export type Dimension = keyof typeof DIMENSIONS;
export const DIMENSION_KEYS = Object.keys(DIMENSIONS) as Dimension[];

export interface TopRow {
  value: string;
  count: number;
  visitors: number;
}

export interface PropertyKeyRow {
  key: string;
  count: number;
}

export interface NumericSummary {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
}

export interface PropertyBreakdown {
  rows: TopRow[];
  /** Renseigne si la propriete contient des valeurs numeriques (ex : prix). */
  numeric: NumericSummary | null;
}

export interface EventListQuery {
  limit: number;
  /** Pagination par curseur : id strictement inferieur. */
  before?: number;
  propKey?: string;
  propValue?: string;
}
