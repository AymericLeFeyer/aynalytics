import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { Card, Col, Row, Skeleton, Statistic, Typography } from 'antd';
import type { Overview, OverviewComparison } from '../../domain/analytics/entities/Stats';
import { formatInt, variation } from '../../shared/format';

const KPIS: { key: keyof Overview; label: string }[] = [
  { key: 'visitors', label: 'Visiteurs' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'screens', label: 'Écrans vus' },
  { key: 'events', label: 'Événements' },
];

function Delta({ current, previous }: { current: number; previous: number }) {
  const delta = variation(current, previous);
  if (delta === null) return <Typography.Text type="secondary">nouveau</Typography.Text>;
  if (delta === 0) return <Typography.Text type="secondary">= période préc.</Typography.Text>;
  const up = delta > 0;
  return (
    <Typography.Text type={up ? 'success' : 'danger'}>
      {up ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {Math.abs(delta).toFixed(0)} % vs période préc.
    </Typography.Text>
  );
}

export function KpiCards({ data, loading }: { data: OverviewComparison | undefined; loading: boolean }) {
  return (
    <Row gutter={[16, 16]}>
      {KPIS.map(({ key, label }) => (
        <Col key={key} xs={12} lg={6}>
          <Card size="small">
            {loading && !data ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <>
                <Statistic
                  title={label}
                  value={data?.current[key] ?? 0}
                  formatter={(v) => formatInt(Number(v))}
                />
                {data && <Delta current={data.current[key]} previous={data.previous[key]} />}
              </>
            )}
          </Card>
        </Col>
      ))}
    </Row>
  );
}
