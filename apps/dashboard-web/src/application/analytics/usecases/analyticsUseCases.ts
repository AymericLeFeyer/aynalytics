import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { analyticsRepository } from '../../../composition';
import type { Dimension, EventQuery, Interval, StatsFilter } from '../../../domain/analytics/entities/Stats';

const tzOffset = () => -new Date().getTimezoneOffset();

export function useOverview(filter: StatsFilter) {
  return useQuery({
    queryKey: ['overview', filter],
    queryFn: () => analyticsRepository.overview(filter),
    placeholderData: keepPreviousData,
  });
}

export function useTimeseries(filter: StatsFilter, interval: Interval) {
  return useQuery({
    queryKey: ['timeseries', filter, interval],
    queryFn: () => analyticsRepository.timeseries(filter, interval, tzOffset()),
    placeholderData: keepPreviousData,
  });
}

/** Repartition par site ; `filter.siteId` est ignore (inutile dans la cle de cache). */
export function useSitesBreakdown(filter: StatsFilter, enabled = true) {
  const { siteId: _ignored, ...allSites } = filter;
  return useQuery({
    queryKey: ['sitesBreakdown', allSites],
    queryFn: () => analyticsRepository.sites(allSites),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useTimeseriesBySite(filter: StatsFilter, interval: Interval, enabled = true) {
  const { siteId: _ignored, ...allSites } = filter;
  return useQuery({
    queryKey: ['timeseriesBySite', allSites, interval],
    queryFn: () => analyticsRepository.timeseriesBySite(allSites, interval, tzOffset()),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useTopValues(filter: StatsFilter, dimension: Dimension, limit = 10) {
  return useQuery({
    queryKey: ['top', filter, dimension, limit],
    queryFn: () => analyticsRepository.top(filter, dimension, limit),
    placeholderData: keepPreviousData,
  });
}

export function usePropertyKeys(filter: StatsFilter, enabled = true) {
  return useQuery({
    queryKey: ['propertyKeys', filter],
    queryFn: () => analyticsRepository.propertyKeys(filter),
    enabled,
  });
}

export function usePropertyBreakdown(filter: StatsFilter, key: string | undefined, limit = 50) {
  return useQuery({
    queryKey: ['breakdown', filter, key, limit],
    queryFn: () => analyticsRepository.breakdown(filter, key as string, limit),
    enabled: !!key,
    placeholderData: keepPreviousData,
  });
}

export function useEventStream(filter: StatsFilter, query: Omit<EventQuery, 'before'> = {}) {
  return useInfiniteQuery({
    queryKey: ['events', filter, query],
    queryFn: ({ pageParam }) =>
      analyticsRepository.events(filter, { limit: 50, ...query, before: pageParam }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
