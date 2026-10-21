import type { AnalyticsRepository, Overview, StatsFilter } from '@aynalytics/core';

/** Vue d'ensemble de la periode + periode precedente de meme duree (pour les variations). */
export class GetOverview {
  constructor(private readonly analytics: AnalyticsRepository) {}

  execute(filter: StatsFilter): { current: Overview; previous: Overview } {
    const span = filter.to - filter.from;
    return {
      current: this.analytics.overview(filter),
      previous: this.analytics.overview({ ...filter, from: filter.from - span, to: filter.from }),
    };
  }
}
