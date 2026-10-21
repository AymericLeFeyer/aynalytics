import dayjs from 'dayjs';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Interval, StatsFilter } from '../../domain/analytics/entities/Stats';
import type { RangePreset } from '../../shared/constants';

const STORAGE_KEY = 'aynalytics:filters';

interface Range {
  from: number;
  to: number;
}

interface FiltersState {
  siteId: string | undefined;
  preset: RangePreset | 'custom';
  range: Range;
}

interface FiltersContextValue extends FiltersState {
  /** Filtre de base (site + periode) a enrichir par chaque page. */
  filter: StatsFilter;
  interval: Interval;
  setSiteId: (siteId: string | undefined) => void;
  setPreset: (preset: RangePreset) => void;
  setCustomRange: (range: Range) => void;
  refresh: () => void;
}

/** Calcule la periode au moment du choix (et non a chaque rendu) pour garder des cles de cache stables. */
function rangeFromPreset(preset: RangePreset): Range {
  const now = dayjs();
  if (preset === '24h')
    return { from: now.subtract(24, 'hour').startOf('hour').valueOf(), to: now.valueOf() };
  const days = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }[preset];
  return {
    from: now
      .subtract(days - 1, 'day')
      .startOf('day')
      .valueOf(),
    to: now.endOf('day').valueOf() + 1,
  };
}

function loadInitial(): FiltersState {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<FiltersState> | null;
    const preset = stored?.preset && stored.preset !== 'custom' ? stored.preset : '7d';
    return { siteId: stored?.siteId, preset, range: rangeFromPreset(preset) };
  } catch {
    return { siteId: undefined, preset: '7d', range: rangeFromPreset('7d') };
  }
}

function persist(state: FiltersState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ siteId: state.siteId, preset: state.preset }));
  } catch {
    // stockage indisponible : preferences non memorisees
  }
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FiltersState>(loadInitial);

  const update = useCallback((next: (prev: FiltersState) => FiltersState) => {
    setState((prev) => {
      const value = next(prev);
      persist(value);
      return value;
    });
  }, []);

  const value = useMemo<FiltersContextValue>(() => {
    const span = state.range.to - state.range.from;
    return {
      ...state,
      filter: { siteId: state.siteId, from: state.range.from, to: state.range.to },
      interval: span <= 2 * 86_400_000 ? 'hour' : 'day',
      setSiteId: (siteId) => update((prev) => ({ ...prev, siteId })),
      setPreset: (preset) => update((prev) => ({ ...prev, preset, range: rangeFromPreset(preset) })),
      setCustomRange: (range) => update((prev) => ({ ...prev, preset: 'custom', range })),
      refresh: () =>
        update((prev) =>
          prev.preset === 'custom' ? { ...prev } : { ...prev, range: rangeFromPreset(prev.preset) },
        ),
    };
  }, [state, update]);

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersContextValue {
  const context = useContext(FiltersContext);
  if (!context) throw new Error('useFilters doit etre utilise dans <FiltersProvider>');
  return context;
}
