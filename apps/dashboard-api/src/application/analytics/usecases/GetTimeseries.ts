import type { AnalyticsRepository, Interval, StatsFilter, TimeseriesPoint } from '@aynalytics/core';
import { DomainError, INTERVAL_MS } from '@aynalytics/core';

const MAX_BUCKETS = 1000;

export class GetTimeseries {
  constructor(private readonly analytics: AnalyticsRepository) {}

  execute(filter: StatsFilter, interval: Interval, tzOffsetMinutes: number): TimeseriesPoint[] {
    if ((filter.to - filter.from) / INTERVAL_MS[interval] > MAX_BUCKETS) {
      throw new DomainError('Période trop longue pour cet intervalle');
    }
    return this.analytics.timeseries(filter, interval, tzOffsetMinutes);
  }
}
