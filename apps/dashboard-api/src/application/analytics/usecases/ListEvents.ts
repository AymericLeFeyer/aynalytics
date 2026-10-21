import type { AnalyticsRepository, EventListQuery, StatsFilter, StoredEvent } from '@aynalytics/core';

export class ListEvents {
  constructor(private readonly analytics: AnalyticsRepository) {}

  execute(filter: StatsFilter, query: EventListQuery): { items: StoredEvent[]; nextCursor: number | null } {
    const items = this.analytics.listEvents(filter, query);
    const last = items.at(-1);
    return { items, nextCursor: items.length === query.limit && last ? last.id : null };
  }
}
