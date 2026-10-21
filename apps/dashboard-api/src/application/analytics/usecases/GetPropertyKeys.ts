import type { AnalyticsRepository, PropertyKeyRow, StatsFilter } from '@aynalytics/core';

/** Cles de proprietes dynamiques rencontrees (typiquement pour un `name` d'evenement donne). */
export class GetPropertyKeys {
  constructor(private readonly analytics: AnalyticsRepository) {}

  execute(filter: StatsFilter): PropertyKeyRow[] {
    return this.analytics.propertyKeys(filter);
  }
}
