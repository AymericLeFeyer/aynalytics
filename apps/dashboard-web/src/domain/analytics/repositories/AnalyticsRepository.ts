import type {
  Dimension,
  EventPage,
  EventQuery,
  GroupField,
  GroupRow,
  Interval,
  OverviewComparison,
  PropertyBreakdown,
  PropertyKeyRow,
  SitesBreakdown,
  SiteTimeseries,
  StatsFilter,
  TimeseriesPoint,
  TopRow,
} from '../entities/Stats';

export interface AnalyticsRepository {
  overview(filter: StatsFilter): Promise<OverviewComparison>;
  timeseries(filter: StatsFilter, interval: Interval, tzOffsetMinutes: number): Promise<TimeseriesPoint[]>;
  /** Tous sites confondus : `filter.siteId` est ignore. */
  sites(filter: StatsFilter): Promise<SitesBreakdown>;
  /** Tous sites confondus : `filter.siteId` est ignore. */
  timeseriesBySite(
    filter: StatsFilter,
    interval: Interval,
    tzOffsetMinutes: number,
  ): Promise<SiteTimeseries[]>;
  top(filter: StatsFilter, dimension: Dimension, limit: number): Promise<TopRow[]>;
  propertyKeys(filter: StatsFilter): Promise<PropertyKeyRow[]>;
  breakdown(filter: StatsFilter, key: string, limit: number): Promise<PropertyBreakdown>;
  groups(
    filter: StatsFilter,
    fields: GroupField[],
    interval: Interval,
    tzOffsetMinutes: number,
    limit: number,
  ): Promise<GroupRow[]>;
  events(filter: StatsFilter, query: EventQuery): Promise<EventPage>;
}
