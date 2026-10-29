import { Card, Col, Row, Segmented, Select, Space, Tag } from 'antd';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useOverview,
  useTimeseries,
  useTopValues,
} from '../../application/analytics/usecases/analyticsUseCases';
import type { EventType, GroupField, StatsFilter } from '../../domain/analytics/entities/Stats';
import { EventsTable } from '../components/EventsTable';
import { GroupedStatsCard } from '../components/GroupedStatsCard';
import { KpiCards } from '../components/KpiCards';
import { PropertyExplorer } from '../components/PropertyExplorer';
import { TimeseriesChart } from '../components/TimeseriesChart';
import { TopTable } from '../components/TopTable';
import { useFilters } from '../hooks/useFilters';
import { useSiteNames } from '../hooks/useSiteNames';

/** Etat de l'explorateur dans l'URL : partageable et compatible bouton retour. */
function useExplorerParams() {
  const [params, setParams] = useSearchParams();
  const set = (patch: Record<string, string | string[] | undefined>) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) {
        next.delete(key);
        if (Array.isArray(value)) value.forEach((v) => next.append(key, v));
        else if (value) next.set(key, value);
      }
      return next;
    });
  const groups = params.getAll('group');
  return {
    type: (params.get('type') as EventType | null) ?? 'event',
    name: params.get('name') ?? undefined,
    key: params.get('key') ?? undefined,
    value: params.get('value') ?? undefined,
    // Chaine stable pour la memoisation : getAll renvoie un nouveau tableau a chaque rendu.
    groupKey: groups.join('\u0000'),
    set,
  };
}

export function EventsPage() {
  const { filter: base, interval, setSiteId } = useFilters();
  const siteName = useSiteNames();
  const { type, name, key, value, groupKey, set } = useExplorerParams();
  const groupFields = useMemo(() => (groupKey ? (groupKey.split('\u0000') as GroupField[]) : []), [groupKey]);

  const typeFilter = useMemo<StatsFilter>(() => ({ ...base, type }), [base, type]);
  const filter = useMemo<StatsFilter>(() => ({ ...typeFilter, name }), [typeFilter, name]);
  const names = useTopValues(typeFilter, 'name', 100);
  const overview = useOverview(filter);
  const series = useTimeseries(filter, interval);
  const bySite = useTopValues(filter, 'site', 50);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small">
        <Space wrap>
          <Segmented
            value={type}
            onChange={(v) => set({ type: v as string, name: undefined, key: undefined, value: undefined })}
            options={[
              { value: 'event', label: 'Événements' },
              { value: 'screen', label: 'Écrans' },
            ]}
          />
          <Select
            style={{ minWidth: 280 }}
            placeholder={type === 'event' ? 'Tous les événements' : 'Tous les écrans'}
            allowClear
            showSearch
            loading={names.isLoading}
            value={name}
            onChange={(v?: string) => set({ name: v, key: undefined, value: undefined })}
            options={(names.data ?? []).map((row) => ({
              value: row.value,
              label: `${row.value} (${row.count})`,
            }))}
          />
          {key && value !== undefined && (
            <Tag closable onClose={() => set({ value: undefined })} color="geekblue">
              {key} = {value}
            </Tag>
          )}
        </Space>
      </Card>

      <KpiCards data={overview.data} loading={overview.isLoading} />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card size="small" title={name ?? (type === 'event' ? 'Tous les événements' : 'Tous les écrans')}>
            <TimeseriesChart points={series.data} interval={interval} loading={series.isFetching} />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <PropertyExplorer
            filter={filter}
            propertyKey={key}
            onKeyChange={(k) => set({ key: k, value: undefined })}
            onValueSelect={(v) => set({ value: v })}
          />
        </Col>
      </Row>

      {/* Tous les sites : quel site genere cet evenement ; un clic filtre sur ce site. */}
      {!base.siteId && (
        <TopTable
          title="Par site"
          valueLabel="Site"
          rows={bySite.data}
          loading={bySite.isFetching}
          formatValue={siteName}
          onSelect={setSiteId}
        />
      )}

      <GroupedStatsCard
        filter={filter}
        fields={groupFields}
        onFieldsChange={(fields) => set({ group: fields })}
      />

      <EventsTable
        filter={filter}
        query={key && value !== undefined ? { propKey: key, propValue: value } : {}}
      />
    </Space>
  );
}
