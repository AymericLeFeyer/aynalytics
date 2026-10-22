import { Line } from '@ant-design/plots';
import { Card, Empty, Progress, Segmented, Spin, Table, theme, Typography } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import {
  useSitesBreakdown,
  useTimeseriesBySite,
} from '../../application/analytics/usecases/analyticsUseCases';
import type { Interval, Overview, SiteOverview, StatsFilter } from '../../domain/analytics/entities/Stats';
import { formatInt, variation } from '../../shared/format';
import { useSiteNames } from '../hooks/useSiteNames';
import { lineTheme } from './TimeseriesChart';

type Metric = Exclude<keyof Overview, 'total'>;

const METRICS: { value: Metric; label: string }[] = [
  { value: 'visitors', label: 'Visiteurs' },
  { value: 'sessions', label: 'Visites' },
  { value: 'screens', label: 'Pages vues' },
  { value: 'events', label: 'Événements' },
];

function Delta({ current, previous }: { current: number; previous: number | undefined }) {
  const delta = variation(current, previous ?? 0);
  if (delta === null) return <Typography.Text type="secondary">nouveau</Typography.Text>;
  if (Math.round(delta) === 0) return <Typography.Text type="secondary">=</Typography.Text>;
  return (
    <Typography.Text type={delta > 0 ? 'success' : 'danger'}>
      {delta > 0 ? '+' : '-'}
      {Math.abs(delta).toFixed(0)} %
    </Typography.Text>
  );
}

interface BreakdownProps {
  filter: StatsFilter;
  /** Clic sur un site : bascule le dashboard sur ce site. */
  onSelect: (siteId: string) => void;
}

/** Tableau de repartition par site : part de chaque site, chiffres cles et variation. */
export function SitesBreakdownCard({ filter, onSelect }: BreakdownProps) {
  const [metric, setMetric] = useState<Metric>('visitors');
  const siteName = useSiteNames();
  const { data, isFetching } = useSitesBreakdown(filter);

  const previous = useMemo(() => new Map((data?.previous ?? []).map((site) => [site.siteId, site])), [data]);
  const rows = useMemo(
    () => [...(data?.current ?? [])].sort((a, b) => b[metric] - a[metric]),
    [data, metric],
  );
  const total = rows.reduce((sum, site) => sum + site[metric], 0);
  const label = METRICS.find((m) => m.value === metric)?.label;

  return (
    <Card
      size="small"
      title="Répartition par site"
      extra={<Segmented<Metric> size="small" value={metric} onChange={setMetric} options={METRICS} />}
      styles={{ body: { padding: 0 } }}
    >
      <Table<SiteOverview>
        size="small"
        rowKey="siteId"
        loading={isFetching && !data}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 560 }}
        locale={{ emptyText: 'Aucune donnée sur la période' }}
        onRow={(row) => ({ onClick: () => onSelect(row.siteId), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Site',
            dataIndex: 'siteId',
            ellipsis: true,
            render: (siteId: string, row) => {
              const share = total > 0 ? (row[metric] / total) * 100 : 0;
              return (
                <div>
                  <Typography.Text strong>{siteName(siteId)}</Typography.Text>
                  <Progress
                    percent={share}
                    format={() => `${share.toFixed(share < 10 ? 1 : 0)} %`}
                    size="small"
                    strokeLinecap="square"
                  />
                </div>
              );
            },
          },
          ...METRICS.map(({ value, label: title }) => ({
            title,
            dataIndex: value,
            width: 95,
            align: 'right' as const,
            render: (count: number) =>
              value === metric ? (
                <Typography.Text strong>{formatInt(count)}</Typography.Text>
              ) : (
                formatInt(count)
              ),
          })),
          {
            title: <span title={`Variation des ${label?.toLowerCase()} vs période préc.`}>Évol.</span>,
            key: 'delta',
            width: 80,
            align: 'right' as const,
            render: (_: unknown, row) => (
              <Delta current={row[metric]} previous={previous.get(row.siteId)?.[metric]} />
            ),
          },
        ]}
      />
    </Card>
  );
}

type SeriesMetric = 'visitors' | 'count';

interface SeriesProps {
  filter: StatsFilter;
  interval: Interval;
  height?: number;
}

/** Une courbe par site, pour comparer leur activite dans le temps. */
export function SitesTimeseriesCard({ filter, interval, height = 300 }: SeriesProps) {
  const { token } = theme.useToken();
  const [metric, setMetric] = useState<SeriesMetric>('visitors');
  const siteName = useSiteNames();
  const { data: series, isFetching } = useTimeseriesBySite(filter, interval);
  const format = interval === 'hour' ? 'DD/MM HH:mm' : 'DD/MM';

  const data = useMemo(
    () =>
      (series ?? []).flatMap(({ siteId, points }) =>
        points.map((p) => ({
          date: dayjs(p.bucket).format(format),
          value: p[metric],
          site: siteName(siteId),
        })),
      ),
    [series, metric, format, siteName],
  );

  const content = !series ? (
    <Spin spinning={isFetching}>
      <div style={{ height }} />
    </Spin>
  ) : series.length === 0 ? (
    <Empty description="Aucune donnée sur la période" />
  ) : (
    <Line
      height={height}
      data={data}
      xField="date"
      yField="value"
      colorField="site"
      shapeField="smooth"
      {...lineTheme(token)}
      tooltip={{ items: [{ channel: 'y', valueFormatter: (v: number) => formatInt(v) }] }}
    />
  );

  return (
    <Card
      size="small"
      title="Activité par site"
      extra={
        <Segmented<SeriesMetric>
          size="small"
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'visitors', label: 'Visiteurs' },
            { value: 'count', label: 'Total' },
          ]}
        />
      }
    >
      {content}
    </Card>
  );
}
