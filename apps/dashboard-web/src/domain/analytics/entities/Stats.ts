export type EventType = 'screen' | 'event';
export type Interval = 'hour' | 'day';
export type Dimension =
  | 'name'
  | 'path'
  | 'source'
  | 'referrer'
  | 'utm_source'
  | 'utm_medium'
  | 'utm_campaign'
  | 'browser'
  | 'os'
  | 'device'
  | 'language'
  | 'title'
  | 'country'
  | 'region'
  | 'city'
  | 'timezone'
  | 'screen'
  | 'color_scheme'
  | 'connection';

export interface StatsFilter {
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

export interface OverviewComparison {
  current: Overview;
  previous: Overview;
}

export interface TimeseriesPoint {
  bucket: number;
  count: number;
  visitors: number;
}

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
  numeric: NumericSummary | null;
}

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface TrackedEvent {
  id: number;
  siteId: string;
  type: EventType;
  name: string;
  properties: Record<string, JsonValue>;
  ts: number;
  sessionId: string | null;
  anonymousId: string | null;
  userId: string | null;
  url: string | null;
  path: string | null;
  referrer: string | null;
  source: string;
  utm: Record<'source' | 'medium' | 'campaign' | 'term' | 'content', string | null>;
  browser: string | null;
  os: string | null;
  device: string | null;
  language: string | null;
  screenWidth: number | null;
  title: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
  screenHeight: number | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  pixelRatio: number | null;
  colorScheme: string | null;
  connection: string | null;
  context: Record<string, JsonValue>;
}

export interface EventQuery {
  limit?: number;
  before?: number;
  propKey?: string;
  propValue?: string;
}

export interface EventPage {
  items: TrackedEvent[];
  nextCursor: number | null;
}
