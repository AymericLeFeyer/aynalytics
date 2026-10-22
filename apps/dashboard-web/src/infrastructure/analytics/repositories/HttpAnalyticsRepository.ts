import type {
  Dimension,
  EventPage,
  EventQuery,
  Interval,
  OverviewComparison,
  PropertyBreakdown,
  PropertyKeyRow,
  SitesBreakdown,
  SiteTimeseries,
  StatsFilter,
  TimeseriesPoint,
  TopRow,
} from '../../../domain/analytics/entities/Stats';
import type { AnalyticsRepository } from '../../../domain/analytics/repositories/AnalyticsRepository';
import type { HttpClient } from '../../http/httpClient';

export class HttpAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly http: HttpClient) {}

  overview(filter: StatsFilter) {
    return this.http.get<OverviewComparison>('/api/stats/overview', { ...filter });
  }

  timeseries(filter: StatsFilter, interval: Interval, tz: number) {
    return this.http.get<TimeseriesPoint[]>('/api/stats/timeseries', { ...filter, interval, tz });
  }

  sites(filter: StatsFilter) {
    return this.http.get<SitesBreakdown>('/api/stats/sites', { ...filter });
  }

  timeseriesBySite(filter: StatsFilter, interval: Interval, tz: number) {
    return this.http.get<SiteTimeseries[]>('/api/stats/timeseries/sites', { ...filter, interval, tz });
  }

  top(filter: StatsFilter, dimension: Dimension, limit: number) {
    return this.http.get<TopRow[]>('/api/stats/top', { ...filter, dimension, limit });
  }

  propertyKeys(filter: StatsFilter) {
    return this.http.get<PropertyKeyRow[]>('/api/stats/properties', { ...filter });
  }

  breakdown(filter: StatsFilter, key: string, limit: number) {
    return this.http.get<PropertyBreakdown>('/api/stats/breakdown', { ...filter, key, limit });
  }

  events(filter: StatsFilter, query: EventQuery) {
    return this.http.get<EventPage>('/api/events', { ...filter, ...query });
  }
}
