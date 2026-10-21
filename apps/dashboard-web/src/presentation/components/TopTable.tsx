import { Card, Progress, Table, Typography } from 'antd';
import type { ReactNode } from 'react';
import type { TopRow } from '../../domain/analytics/entities/Stats';
import { formatInt } from '../../shared/format';

interface Props {
  title: ReactNode;
  rows: TopRow[] | undefined;
  loading?: boolean;
  valueLabel?: string;
  /** Rend les lignes cliquables (drill-down). */
  onSelect?: (value: string) => void;
  extra?: ReactNode;
  /** Libelle affiche (la valeur brute reste utilisee pour le drill-down). */
  formatValue?: (value: string) => string;
}

export function TopTable({
  title,
  rows,
  loading,
  valueLabel = 'Valeur',
  onSelect,
  extra,
  formatValue = (value) => value,
}: Props) {
  const max = Math.max(1, ...(rows ?? []).map((r) => r.count));
  return (
    <Card size="small" title={title} extra={extra} styles={{ body: { padding: 0 } }}>
      <Table<TopRow>
        size="small"
        rowKey="value"
        loading={loading && !rows}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: 'Aucune donnée' }}
        onRow={(row) => ({
          onClick: onSelect ? () => onSelect(row.value) : undefined,
          style: onSelect ? { cursor: 'pointer' } : undefined,
        })}
        columns={[
          {
            title: valueLabel,
            dataIndex: 'value',
            ellipsis: true,
            render: (value: string, row) => (
              <div>
                <Typography.Text ellipsis={{ tooltip: value }}>{formatValue(value)}</Typography.Text>
                <Progress
                  percent={(row.count / max) * 100}
                  showInfo={false}
                  size="small"
                  strokeLinecap="square"
                />
              </div>
            ),
          },
          { title: 'Total', dataIndex: 'count', width: 90, align: 'right', render: formatInt },
          { title: 'Visiteurs', dataIndex: 'visitors', width: 90, align: 'right', render: formatInt },
        ]}
      />
    </Card>
  );
}
