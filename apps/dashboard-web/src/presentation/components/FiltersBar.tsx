import { ReloadOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { Button, DatePicker, Select, Space, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { useSites } from '../../application/sites/usecases/siteUseCases';
import { RANGE_PRESETS } from '../../shared/constants';
import { useFilters } from '../hooks/useFilters';

const ALL_SITES = '__all__';

export function FiltersBar() {
  const { siteId, preset, range, setSiteId, setPreset, setCustomRange, refresh } = useFilters();
  const { data: sites = [], isLoading } = useSites();
  const queryClient = useQueryClient();

  return (
    <Space wrap>
      <Select
        style={{ minWidth: 200 }}
        loading={isLoading}
        value={siteId ?? ALL_SITES}
        onChange={(value) => setSiteId(value === ALL_SITES ? undefined : value)}
        options={[
          { value: ALL_SITES, label: 'Tous les sites' },
          ...sites.map((site) => ({ value: site.id, label: site.name })),
        ]}
      />
      <Select
        style={{ width: 130 }}
        value={preset === 'custom' ? undefined : preset}
        placeholder="Personnalisé"
        onChange={setPreset}
        options={RANGE_PRESETS}
      />
      <DatePicker.RangePicker
        allowClear={false}
        value={[dayjs(range.from), dayjs(range.to - 1)]}
        format="DD/MM/YYYY"
        onChange={(dates) => {
          const [start, end] = dates ?? [];
          if (start && end) {
            setCustomRange({ from: start.startOf('day').valueOf(), to: end.endOf('day').valueOf() + 1 });
          }
        }}
      />
      <Tooltip title="Actualiser">
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            refresh();
            void queryClient.invalidateQueries();
          }}
        />
      </Tooltip>
    </Space>
  );
}
