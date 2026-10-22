import { Line } from '@ant-design/plots';
import type { GlobalToken } from 'antd';
import { Empty, Spin, theme } from 'antd';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import type { Interval, TimeseriesPoint } from '../../domain/analytics/entities/Stats';
import { formatInt } from '../../shared/format';

/**
 * Axes et legende aux couleurs du theme antd : le theme G2 par defaut est illisible en
 * mode sombre. Partage par toutes les courbes du dashboard.
 */
export function lineTheme(token: GlobalToken) {
  return {
    axis: {
      x: {
        labelAutoHide: true,
        labelAutoRotate: false,
        labelFill: token.colorTextSecondary,
        lineStroke: token.colorBorder,
        tickStroke: token.colorBorder,
      },
      y: {
        labelFormatter: (v: number) => formatInt(v),
        labelFill: token.colorTextSecondary,
        gridStroke: token.colorBorderSecondary,
        gridStrokeOpacity: 1,
      },
    },
    legend: { color: { position: 'top' as const, itemLabelFill: token.colorText } },
  };
}

interface Props {
  points: TimeseriesPoint[] | undefined;
  interval: Interval;
  loading?: boolean;
  countLabel?: string;
  height?: number;
}

export function TimeseriesChart({ points, interval, loading, countLabel = 'Total', height = 280 }: Props) {
  const { token } = theme.useToken();
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
      {...lineTheme(token)}
      tooltip={{ items: [{ channel: 'y', valueFormatter: (v: number) => formatInt(v) }] }}
    />
  );
}
