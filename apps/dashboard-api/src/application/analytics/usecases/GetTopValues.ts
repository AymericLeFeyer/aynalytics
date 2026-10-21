import type { AnalyticsRepository, Dimension, StatsFilter, TopRow } from '@aynalytics/core';

export class GetTopValues {
  constructor(private readonly analytics: AnalyticsRepository) {}

  execute(filter: StatsFilter, dimension: Dimension, limit: number): TopRow[] {
    return this.analytics.top(filter, dimension, limit);
  }
}
