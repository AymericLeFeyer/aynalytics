import type { AnalyticsRepository, Interval, SiteTimeseries, StatsFilter } from '@aynalytics/core';
import { DomainError, INTERVAL_MS } from '@aynalytics/core';

const MAX_BUCKETS = 1000;

/** Une serie par site (tous sites confondus, `siteId` ignore). */
export class GetTimeseriesBySite {
  constructor(private readonly analytics: AnalyticsRepository) {}

  execute(filter: StatsFilter, interval: Interval, tzOffsetMinutes: number): SiteTimeseries[] {
    if ((filter.to - filter.from) / INTERVAL_MS[interval] > MAX_BUCKETS) {
      throw new DomainError('Période trop longue pour cet intervalle');
    }
    const { siteId: _ignored, ...allSites } = filter;
    return this.analytics.timeseriesBySite(allSites, interval, tzOffsetMinutes);
  }
}
