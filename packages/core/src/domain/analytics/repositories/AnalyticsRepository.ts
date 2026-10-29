import type { StoredEvent } from '../../events/entities/TrackedEvent';
import type {
  Dimension,
  EventListQuery,
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
} from '../entities/Stats';

export interface AnalyticsRepository {
  overview(filter: StatsFilter): Overview;
  /** `tzOffsetMinutes` : decalage du fuseau du lecteur (ex : +120 a Paris en ete) pour aligner les jours. */
  timeseries(filter: StatsFilter, interval: Interval, tzOffsetMinutes: number): TimeseriesPoint[];
  /** Vue d'ensemble par site ayant des evenements sur la periode, visiteurs decroissants. */
  overviewBySite(filter: StatsFilter): SiteOverview[];
  /** Une serie par site ayant des evenements sur la periode (trous remplis a 0). */
  timeseriesBySite(filter: StatsFilter, interval: Interval, tzOffsetMinutes: number): SiteTimeseries[];
  top(filter: StatsFilter, dimension: Dimension, limit: number): TopRow[];
  propertyKeys(filter: StatsFilter): PropertyKeyRow[];
  propertyBreakdown(filter: StatsFilter, key: string, limit: number): PropertyBreakdown;
  /** Regroupement multi-champs, groupes tries par visiteurs puis volume decroissants. */
  groupBy(filter: StatsFilter, query: GroupQuery): GroupRow[];
  listEvents(filter: StatsFilter, query: EventListQuery): StoredEvent[];
}
