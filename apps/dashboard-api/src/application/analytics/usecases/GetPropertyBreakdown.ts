import type { AnalyticsRepository, PropertyBreakdown, StatsFilter } from '@aynalytics/core';

export class GetPropertyBreakdown {
  constructor(private readonly analytics: AnalyticsRepository) {}

  execute(filter: StatsFilter, key: string, limit: number): PropertyBreakdown {
    return this.analytics.propertyBreakdown(filter, key, limit);
  }
}
