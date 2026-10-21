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

/** Dimensions groupables (whitelist : la colonne SQL est derivee de cette liste, jamais de l'entree brute). */
export const DIMENSIONS = {
  name: 'name',
  path: 'path',
  source: 'source',
  referrer: 'referrer_host',
  utm_source: 'utm_source',
  utm_medium: 'utm_medium',
  utm_campaign: 'utm_campaign',
  browser: 'browser',
  os: 'os',
  device: 'device',
  language: 'language',
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
