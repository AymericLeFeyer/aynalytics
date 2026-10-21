import { Card, Col, Empty, Row, Select, Space, Statistic } from 'antd';
import {
  usePropertyBreakdown,
  usePropertyKeys,
} from '../../application/analytics/usecases/analyticsUseCases';
import type { StatsFilter } from '../../domain/analytics/entities/Stats';
import { formatNumber } from '../../shared/format';
import { TopTable } from './TopTable';

interface Props {
  filter: StatsFilter;
  propertyKey: string | undefined;
  onKeyChange: (key: string | undefined) => void;
  onValueSelect: (value: string) => void;
}

/** Exploration des proprietes dynamiques : repartition des valeurs + agregats si numerique. */
export function PropertyExplorer({ filter, propertyKey, onKeyChange, onValueSelect }: Props) {
  const keys = usePropertyKeys(filter);
  const breakdown = usePropertyBreakdown(filter, propertyKey);
  const numeric = breakdown.data?.numeric;

  return (
    <Card
      size="small"
      title="Propriétés"
      extra={
        <Select
          style={{ minWidth: 200 }}
          placeholder="Choisir une propriété"
          allowClear
          showSearch
          loading={keys.isLoading}
          value={propertyKey}
          onChange={onKeyChange}
          options={(keys.data ?? []).map((k) => ({ value: k.key, label: `${k.key} (${k.count})` }))}
        />
      }
    >
      {!propertyKey ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            keys.data?.length ? 'Choisis une propriété à analyser' : 'Aucune propriété sur la période'
          }
        />
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {numeric && (
            <Row gutter={16}>
              {(
                [
                  ['Somme', numeric.sum],
                  ['Moyenne', numeric.avg],
                  ['Min', numeric.min],
                  ['Max', numeric.max],
                ] as const
              ).map(([label, value]) => (
                <Col key={label} xs={12} md={6}>
                  <Statistic title={label} value={value} formatter={(v) => formatNumber(Number(v))} />
                </Col>
              ))}
            </Row>
          )}
          <TopTable
            title={`Valeurs de « ${propertyKey} »`}
            rows={breakdown.data?.rows}
            loading={breakdown.isFetching}
            onSelect={onValueSelect}
          />
        </Space>
      )}
    </Card>
  );
}
