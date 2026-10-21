import type {
  Dimension,
  EventPage,
  EventQuery,
  Interval,
  OverviewComparison,
  PropertyBreakdown,
  PropertyKeyRow,
  StatsFilter,
  TimeseriesPoint,
  TopRow,
} from '../entities/Stats';

export interface AnalyticsRepository {
  overview(filter: StatsFilter): Promise<OverviewComparison>;
  timeseries(filter: StatsFilter, interval: Interval, tzOffsetMinutes: number): Promise<TimeseriesPoint[]>;
  top(filter: StatsFilter, dimension: Dimension, limit: number): Promise<TopRow[]>;
  propertyKeys(filter: StatsFilter): Promise<PropertyKeyRow[]>;
  breakdown(filter: StatsFilter, key: string, limit: number): Promise<PropertyBreakdown>;
  events(filter: StatsFilter, query: EventQuery): Promise<EventPage>;
}
