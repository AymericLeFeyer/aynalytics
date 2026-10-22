import type { AnalyticsRepository, SiteOverview, StatsFilter } from '@aynalytics/core';

/**
 * Repartition par site (tous sites confondus, `siteId` ignore) + periode precedente de meme
 * duree, pour la variation de chaque site.
 */
export class GetSitesBreakdown {
  constructor(private readonly analytics: AnalyticsRepository) {}

  execute(filter: StatsFilter): { current: SiteOverview[]; previous: SiteOverview[] } {
    const { siteId: _ignored, ...allSites } = filter;
    const span = filter.to - filter.from;
    return {
      current: this.analytics.overviewBySite(allSites),
      previous: this.analytics.overviewBySite({ ...allSites, from: filter.from - span, to: filter.from }),
    };
  }
}
