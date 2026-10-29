import { Card, Empty, Select, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo } from 'react';
import { useGroupedStats, usePropertyKeys } from '../../application/analytics/usecases/analyticsUseCases';
import type { Dimension, GroupField, GroupRow, StatsFilter } from '../../domain/analytics/entities/Stats';
import { MAX_GROUP_FIELDS } from '../../domain/analytics/entities/Stats';
import { DIMENSION_LABELS } from '../../shared/constants';
import { formatDateTime, formatDimensionValue, formatInt } from '../../shared/format';
import { useFilters } from '../hooks/useFilters';
import { useSiteNames } from '../hooks/useSiteNames';
import { TimeseriesChart } from './TimeseriesChart';

/** Dimensions proposees au regroupement (le nom est deja filtre par la page). */
const GROUP_DIMENSIONS: Dimension[] = [
  'path',
  'title',
  'source',
  'referrer',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'site',
  'country',
  'city',
  'device',
  'browser',
];

const isProperty = (field: GroupField): field is `prop:${string}` => field.startsWith('prop:');
const fieldLabel = (field: GroupField) =>
  isProperty(field) ? `property.${field.slice(5)}` : DIMENSION_LABELS[field];

interface Props {
  filter: StatsFilter;
  fields: GroupField[];
  onFieldsChange: (fields: GroupField[]) => void;
}

/**
 * Regroupement multi-champs (ex : page + source + property.merchant) : combien de personnes
 * pour chaque combinaison, premier/dernier horodatage et courbe du groupe (ligne depliee).
 */
export function GroupedStatsCard({ filter, fields, onFieldsChange }: Props) {
  const { interval } = useFilters();
  const siteName = useSiteNames();
  const keys = usePropertyKeys(filter);
  const groups = useGroupedStats(filter, fields, interval);

  const options = useMemo(
    () => [
      {
        label: 'Dimensions',
        options: GROUP_DIMENSIONS.map((d) => ({ value: d, label: DIMENSION_LABELS[d] })),
      },
      {
        label: 'Propriétés',
        options: (keys.data ?? []).map((k) => ({
          value: `prop:${k.key}`,
          label: `property.${k.key} (${k.count})`,
        })),
      },
    ],
    [keys.data],
  );

  const columns: ColumnsType<GroupRow> = [
    ...fields.map((field, i) => ({
      title: fieldLabel(field),
      key: field,
      ellipsis: true,
      render: (_: unknown, row: GroupRow) => {
        const value = row.values[i] ?? '';
        const label = isProperty(field)
          ? value
          : field === 'site'
            ? siteName(value)
            : formatDimensionValue(field, value);
        return <Typography.Text ellipsis={{ tooltip: value }}>{label}</Typography.Text>;
      },
    })),
    { title: 'Visiteurs', dataIndex: 'visitors', width: 100, align: 'right', render: formatInt },
    { title: 'Total', dataIndex: 'count', width: 90, align: 'right', render: formatInt },
    { title: 'Premier', dataIndex: 'firstTs', width: 170, render: formatDateTime },
    { title: 'Dernier', dataIndex: 'lastTs', width: 170, render: formatDateTime },
  ];

  return (
    <Card
      size="small"
      title="Regroupement"
      styles={{ body: { padding: 0 } }}
      extra={
        <Select<GroupField[]>
          mode="multiple"
          style={{ minWidth: 320, maxWidth: 640 }}
          placeholder={`Regrouper par… (${MAX_GROUP_FIELDS} max)`}
          allowClear
          maxCount={MAX_GROUP_FIELDS}
          loading={keys.isLoading}
          value={fields}
          onChange={onFieldsChange}
          options={options}
        />
      }
    >
      {fields.length === 0 ? (
        <Empty
          style={{ padding: 16 }}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Choisis des champs (page, source, propriétés…) pour compter les visiteurs par combinaison"
        />
      ) : (
        <Table<GroupRow>
          size="small"
          rowKey={(row) => row.values.join('\u0000')}
          loading={groups.isFetching}
          dataSource={groups.data}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'Aucune donnée' }}
          expandable={{
            expandedRowRender: (row) => (
              <TimeseriesChart points={row.points} interval={interval} height={200} />
            ),
          }}
          columns={columns}
        />
      )}
    </Card>
  );
}
