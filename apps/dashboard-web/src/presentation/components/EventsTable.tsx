import { Button, Card, Descriptions, Table, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useEventStream } from '../../application/analytics/usecases/analyticsUseCases';
import type { EventQuery, StatsFilter, TrackedEvent } from '../../domain/analytics/entities/Stats';
import { formatCountry, formatDateTime, formatDimensionValue } from '../../shared/format';

const compact = (properties: TrackedEvent['properties']): string => {
  const text = JSON.stringify(properties);
  return text === '{}' ? '' : text;
};

function EventDetails({ event }: { event: TrackedEvent }) {
  const utm = Object.entries(event.utm)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join(' · ');
  return (
    <Descriptions size="small" column={{ xs: 1, md: 2 }} bordered>
      <Descriptions.Item label="Propriétés" span={2}>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {JSON.stringify(event.properties, null, 2)}
        </pre>
      </Descriptions.Item>
      <Descriptions.Item label="URL">{event.url ?? '-'}</Descriptions.Item>
      <Descriptions.Item label="Référent">{event.referrer ?? '-'}</Descriptions.Item>
      <Descriptions.Item label="UTM">{utm || '-'}</Descriptions.Item>
      <Descriptions.Item label="Utilisateur">{event.userId ?? event.anonymousId ?? '-'}</Descriptions.Item>
      <Descriptions.Item label="Session">{event.sessionId ?? '-'}</Descriptions.Item>
      <Descriptions.Item label="Environnement">
        {[event.device, event.os, event.browser, event.language].filter(Boolean).join(' · ') || '-'}
      </Descriptions.Item>
      <Descriptions.Item label="Titre">{event.title ?? '-'}</Descriptions.Item>
      <Descriptions.Item label="Localisation">
        {[event.city, event.region, event.country && formatCountry(event.country)]
          .filter(Boolean)
          .join(', ') || '-'}
        {event.timezone && <Typography.Text type="secondary"> ({event.timezone})</Typography.Text>}
      </Descriptions.Item>
      <Descriptions.Item label="Affichage">
        {[
          event.screenWidth && `écran ${event.screenWidth}x${event.screenHeight ?? '?'}`,
          event.viewportWidth && `fenêtre ${event.viewportWidth}x${event.viewportHeight ?? '?'}`,
          event.pixelRatio && `x${event.pixelRatio}`,
          event.colorScheme && formatDimensionValue('color_scheme', event.colorScheme),
        ]
          .filter(Boolean)
          .join(' · ') || '-'}
      </Descriptions.Item>
      <Descriptions.Item label="Réseau">{event.connection ?? '-'}</Descriptions.Item>
      <Descriptions.Item label="Contexte navigateur" span={2}>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {JSON.stringify(event.context, null, 2)}
        </pre>
      </Descriptions.Item>
    </Descriptions>
  );
}

interface Props {
  filter: StatsFilter;
  query?: Omit<EventQuery, 'before'>;
  title?: ReactNode;
}

export function EventsTable({ filter, query, title = 'Flux brut' }: Props) {
  const stream = useEventStream(filter, query);
  const rows = stream.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Card size="small" title={title} styles={{ body: { padding: 0 } }}>
      <Table<TrackedEvent>
        size="small"
        rowKey="id"
        loading={stream.isLoading}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 900 }}
        locale={{ emptyText: 'Aucun événement' }}
        expandable={{ expandedRowRender: (event) => <EventDetails event={event} /> }}
        columns={[
          { title: 'Date', dataIndex: 'ts', width: 170, render: formatDateTime },
          {
            title: 'Type',
            dataIndex: 'type',
            width: 90,
            render: (type: TrackedEvent['type']) =>
              type === 'screen' ? <Tag color="blue">écran</Tag> : <Tag color="purple">event</Tag>,
          },
          { title: 'Nom', dataIndex: 'name', width: 200, ellipsis: true },
          {
            title: 'Propriétés',
            dataIndex: 'properties',
            ellipsis: true,
            render: (properties: TrackedEvent['properties']) => (
              <Typography.Text code ellipsis>
                {compact(properties)}
              </Typography.Text>
            ),
          },
          { title: 'Source', dataIndex: 'source', width: 130, ellipsis: true },
          { title: 'Page', dataIndex: 'path', width: 160, ellipsis: true },
        ]}
      />
      {stream.hasNextPage && (
        <div style={{ padding: 12, textAlign: 'center' }}>
          <Button loading={stream.isFetchingNextPage} onClick={() => void stream.fetchNextPage()}>
            Charger plus
          </Button>
        </div>
      )}
    </Card>
  );
}
