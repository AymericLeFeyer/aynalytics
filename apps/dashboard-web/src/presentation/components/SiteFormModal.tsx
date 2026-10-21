import { Form, Input, Modal, Select } from 'antd';
import { useEffect } from 'react';
import type { Site, SiteInput } from '../../domain/sites/entities/Site';

interface Props {
  open: boolean;
  site?: Site;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (input: SiteInput) => void;
}

const ORIGIN_RE = /^https?:\/\/(\*\.)?[a-z0-9.-]+(:\d+)?\/?$/i;

export function SiteFormModal({ open, site, submitting, onCancel, onSubmit }: Props) {
  const [form] = Form.useForm<SiteInput>();

  useEffect(() => {
    if (open) form.setFieldsValue({ name: site?.name ?? '', allowedOrigins: site?.allowedOrigins ?? [] });
  }, [open, site, form]);

  return (
    <Modal
      open={open}
      title={site ? `Modifier ${site.name}` : 'Nouveau site'}
      okText={site ? 'Enregistrer' : 'Créer'}
      cancelText="Annuler"
      confirmLoading={submitting}
      onCancel={onCancel}
      onOk={() => void form.validateFields().then(onSubmit)}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="name" label="Nom" rules={[{ required: true, whitespace: true, max: 100 }]}>
          <Input placeholder="Mon blog" autoFocus />
        </Form.Item>
        <Form.Item
          name="allowedOrigins"
          label="Origines autorisées"
          extra="Seuls ces domaines pourront envoyer des données depuis un navigateur. Ex : https://monsite.fr, https://*.monsite.fr, http://localhost:5173"
          rules={[
            {
              validator: (_, values: string[] = []) => {
                const invalid = values.find((v) => !ORIGIN_RE.test(v.trim()));
                return invalid
                  ? Promise.reject(new Error(`Origine invalide : ${invalid}`))
                  : Promise.resolve();
              },
            },
          ]}
        >
          <Select mode="tags" tokenSeparators={[',', ' ']} placeholder="https://monsite.fr" open={false} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
