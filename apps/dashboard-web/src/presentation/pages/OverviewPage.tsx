import { Card, Col, Row, Segmented, Space } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useOverview,
  useTimeseries,
  useTopValues,
} from '../../application/analytics/usecases/analyticsUseCases';
import type { Dimension } from '../../domain/analytics/entities/Stats';
import { DIMENSION_LABELS } from '../../shared/constants';
import { KpiCards } from '../components/KpiCards';
import { TimeseriesChart } from '../components/TimeseriesChart';
import { TopTable } from '../components/TopTable';
import { useFilters } from '../hooks/useFilters';

const ACQUISITION: Dimension[] = ['source', 'referrer', 'utm_campaign', 'utm_medium'];
const TECH: Dimension[] = ['device', 'browser', 'os', 'language'];

function DimensionCard({ dimensions, title }: { dimensions: Dimension[]; title: string }) {
  const { filter } = useFilters();
  const [dimension, setDimension] = useState<Dimension>(dimensions[0] as Dimension);
  const { data, isFetching } = useTopValues(filter, dimension);
  return (
    <TopTable
      title={title}
      rows={data}
      loading={isFetching}
      valueLabel={DIMENSION_LABELS[dimension]}
      extra={
        <Segmented
          size="small"
          value={dimension}
          onChange={(v) => setDimension(v as Dimension)}
          options={dimensions.map((d) => ({ value: d, label: DIMENSION_LABELS[d] }))}
        />
      }
    />
  );
}

export function OverviewPage() {
  const navigate = useNavigate();
  const { filter, interval } = useFilters();
  const overview = useOverview(filter);
  const series = useTimeseries(filter, interval);
  const screens = useTopValues({ ...filter, type: 'screen' }, 'name');
  const events = useTopValues({ ...filter, type: 'event' }, 'name');

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <KpiCards data={overview.data} loading={overview.isLoading} />

      <Card size="small" title="Activité">
        <TimeseriesChart points={series.data} interval={interval} loading={series.isFetching} />
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <TopTable
            title="Écrans les plus vus"
            valueLabel="Écran"
            rows={screens.data}
            loading={screens.isFetching}
            onSelect={(name) => navigate(`/events?type=screen&name=${encodeURIComponent(name)}`)}
          />
        </Col>
        <Col xs={24} xl={12}>
          <TopTable
            title="Événements"
            valueLabel="Événement"
            rows={events.data}
            loading={events.isFetching}
            onSelect={(name) => navigate(`/events?type=event&name=${encodeURIComponent(name)}`)}
          />
        </Col>
        <Col xs={24} xl={12}>
          <DimensionCard title="Acquisition" dimensions={ACQUISITION} />
        </Col>
        <Col xs={24} xl={12}>
          <DimensionCard title="Technologie" dimensions={TECH} />
        </Col>
      </Row>
    </Space>
  );
}
