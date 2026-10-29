import type { AnalyticsRepository, GroupQuery, GroupRow, StatsFilter } from '@aynalytics/core';
import { DomainError, INTERVAL_MS, MAX_GROUP_FIELDS } from '@aynalytics/core';

const MAX_BUCKETS = 1000;

export class GetGroupedStats {
  constructor(private readonly analytics: AnalyticsRepository) {}

  execute(filter: StatsFilter, query: GroupQuery): GroupRow[] {
    if (query.fields.length === 0 || query.fields.length > MAX_GROUP_FIELDS) {
      throw new DomainError(`Entre 1 et ${MAX_GROUP_FIELDS} champs de regroupement`);
    }
    const ids = query.fields.map((f) => ('dimension' in f ? f.dimension : `prop:${f.property}`));
    if (new Set(ids).size !== ids.length) throw new DomainError('Champ de regroupement en double');
    if ((filter.to - filter.from) / INTERVAL_MS[query.interval] > MAX_BUCKETS) {
      throw new DomainError('Période trop longue pour cet intervalle');
    }
    return this.analytics.groupBy(filter, query);
  }
}
