import { CodeOutlined, DeleteOutlined, EditOutlined, KeyOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Modal, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd';
import { useState } from 'react';
import {
  useCreateSite,
  useDeleteSite,
  useRotateSiteSecret,
  useSites,
  useUpdateSite,
} from '../../application/sites/usecases/siteUseCases';
import type { Site, SiteInput } from '../../domain/sites/entities/Site';
import { formatDateTime } from '../../shared/format';
import { IntegrationSnippet } from '../components/IntegrationSnippet';
import { SiteFormModal } from '../components/SiteFormModal';

type FormState = { mode: 'create' } | { mode: 'edit'; site: Site } | null;
interface SecretState {
  site: Site;
  secretKey: string;
}

export function SitesPage() {
  const { message, modal } = App.useApp();
  const sites = useSites();
  const createSite = useCreateSite();
  const updateSite = useUpdateSite();
  const rotateSecret = useRotateSiteSecret();
  const deleteSite = useDeleteSite();

  const [form, setForm] = useState<FormState>(null);
  const [secret, setSecret] = useState<SecretState | null>(null);
  const [snippetFor, setSnippetFor] = useState<Site | null>(null);

  const onError = (err: Error) => void message.error(err.message);

  const submit = (input: SiteInput) => {
    if (form?.mode === 'edit') {
      updateSite.mutate(
        { id: form.site.id, patch: input },
        { onSuccess: () => (setForm(null), void message.success('Site mis à jour')), onError },
      );
    } else {
      createSite.mutate(input, {
        onSuccess: (created) => (setForm(null), setSecret(created)),
        onError,
      });
    }
  };

  const confirmRotate = (site: Site) =>
    modal.confirm({
      title: `Régénérer la clé secrète de ${site.name} ?`,
      content:
        "L'ancienne clé cessera de fonctionner (envois serveur uniquement, le SDK navigateur n'est pas impacté).",
      okText: 'Régénérer',
      cancelText: 'Annuler',
      onOk: () =>
        rotateSecret.mutateAsync(site.id).then(({ secretKey }) => setSecret({ site, secretKey }), onError),
    });

  const confirmDelete = (site: Site) =>
    modal.confirm({
      title: `Supprimer ${site.name} ?`,
      content: 'Le site et TOUS ses événements seront définitivement supprimés.',
      okText: 'Supprimer',
      okButtonProps: { danger: true },
      cancelText: 'Annuler',
      onOk: () =>
        deleteSite
          .mutateAsync(site.id)
          .then(
            ({ deletedEvents }) => void message.success(`Site supprimé (${deletedEvents} événements)`),
            onError,
          ),
    });

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        size="small"
        title="Sites autorisés"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setForm({ mode: 'create' })}>
            Nouveau site
          </Button>
        }
        styles={{ body: { padding: 0 } }}
      >
        <Table<Site>
          rowKey="id"
          size="middle"
          loading={sites.isLoading}
          dataSource={sites.data}
          pagination={false}
          scroll={{ x: 900 }}
          locale={{ emptyText: 'Aucun site : crée-en un pour obtenir une clé de tracking' }}
          columns={[
            {
              title: 'Nom',
              dataIndex: 'name',
              render: (name: string) => <Typography.Text strong>{name}</Typography.Text>,
            },
            {
              title: 'Clé publique',
              dataIndex: 'publicKey',
              render: (key: string) => (
                <Typography.Text code copyable>
                  {key}
                </Typography.Text>
              ),
            },
            {
              title: 'Origines autorisées',
              dataIndex: 'allowedOrigins',
              render: (origins: string[]) =>
                origins.length ? (
                  <Space size={[4, 4]} wrap>
                    {origins.map((o) => (
                      <Tag key={o}>{o}</Tag>
                    ))}
                  </Space>
                ) : (
                  <Typography.Text type="secondary">serveur uniquement</Typography.Text>
                ),
            },
            {
              title: 'Actif',
              dataIndex: 'active',
              width: 80,
              render: (active: boolean, site) => (
                <Switch
                  checked={active}
                  size="small"
                  onChange={(checked) =>
                    updateSite.mutate({ id: site.id, patch: { active: checked } }, { onError })
                  }
                />
              ),
            },
            { title: 'Créé le', dataIndex: 'createdAt', width: 170, render: formatDateTime },
            {
              title: '',
              key: 'actions',
              width: 170,
              render: (_, site) => (
                <Space>
                  <Tooltip title="Intégration">
                    <Button icon={<CodeOutlined />} onClick={() => setSnippetFor(site)} />
                  </Tooltip>
                  <Tooltip title="Modifier">
                    <Button icon={<EditOutlined />} onClick={() => setForm({ mode: 'edit', site })} />
                  </Tooltip>
                  <Tooltip title="Régénérer la clé secrète">
                    <Button icon={<KeyOutlined />} onClick={() => confirmRotate(site)} />
                  </Tooltip>
                  <Tooltip title="Supprimer">
                    <Button danger icon={<DeleteOutlined />} onClick={() => confirmDelete(site)} />
                  </Tooltip>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <SiteFormModal
        open={form !== null}
        site={form?.mode === 'edit' ? form.site : undefined}
        submitting={createSite.isPending || updateSite.isPending}
        onCancel={() => setForm(null)}
        onSubmit={submit}
      />

      <Modal
        open={secret !== null}
        title={`Clé secrète de ${secret?.site.name ?? ''}`}
        width={760}
        onCancel={() => setSecret(null)}
        footer={<Button onClick={() => setSecret(null)}>J'ai copié la clé</Button>}
        maskClosable={false}
      >
        {secret && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert
              type="warning"
              showIcon
              message="Cette clé ne sera plus jamais affichée."
              description="Elle sert uniquement aux envois serveur-à-serveur. Ne la mets jamais dans du code front."
            />
            <Typography.Paragraph copyable code style={{ fontSize: 13 }}>
              {secret.secretKey}
            </Typography.Paragraph>
            <IntegrationSnippet site={secret.site} secretKey={secret.secretKey} />
          </Space>
        )}
      </Modal>

      <Modal
        open={snippetFor !== null}
        title={`Intégrer ${snippetFor?.name ?? ''}`}
        width={760}
        footer={null}
        onCancel={() => setSnippetFor(null)}
      >
        {snippetFor && <IntegrationSnippet site={snippetFor} />}
      </Modal>
    </Space>
  );
}
