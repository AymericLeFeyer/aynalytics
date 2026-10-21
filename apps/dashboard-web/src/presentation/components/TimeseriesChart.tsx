import { Line } from '@ant-design/plots';
import { Empty, Spin } from 'antd';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import type { Interval, TimeseriesPoint } from '../../domain/analytics/entities/Stats';
import { formatInt } from '../../shared/format';

interface Props {
  points: TimeseriesPoint[] | undefined;
  interval: Interval;
  loading?: boolean;
  countLabel?: string;
  height?: number;
}

export function TimeseriesChart({ points, interval, loading, countLabel = 'Total', height = 280 }: Props) {
  const format = interval === 'hour' ? 'DD/MM HH:mm' : 'DD/MM';
  const data = useMemo(
    () =>
      (points ?? []).flatMap((p) => {
        const date = dayjs(p.bucket).format(format);
        return [
          { date, value: p.count, serie: countLabel },
          { date, value: p.visitors, serie: 'Visiteurs' },
        ];
      }),
    [points, format, countLabel],
  );

  if (!points) return <Spin spinning={loading}>{<div style={{ height }} />}</Spin>;
  if (points.every((p) => p.count === 0)) return <Empty description="Aucune donnée sur la période" />;

  return (
    <Line
      height={height}
      data={data}
      xField="date"
      yField="value"
      colorField="serie"
      shapeField="smooth"
      axis={{
        x: { labelAutoHide: true, labelAutoRotate: false },
        y: { labelFormatter: (v: number) => formatInt(v) },
      }}
      legend={{ color: { position: 'top' } }}
      tooltip={{ items: [{ channel: 'y', valueFormatter: (v: number) => formatInt(v) }] }}
    />
  );
}
