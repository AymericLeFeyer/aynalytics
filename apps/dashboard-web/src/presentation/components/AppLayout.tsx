import { AppstoreOutlined, DashboardOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Grid, Layout, Menu, theme, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FiltersBar } from './FiltersBar';

const MENU = [
  { key: '/', icon: <DashboardOutlined />, label: "Vue d'ensemble" },
  { key: '/events', icon: <ThunderboltOutlined />, label: 'Explorer' },
  { key: '/sites', icon: <AppstoreOutlined />, label: 'Sites' },
];

export function AppLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const screens = Grid.useBreakpoint();
  const { token } = theme.useToken();
  const showFilters = pathname !== '/sites';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider breakpoint="lg" collapsedWidth={0} theme="light" width={220}>
        <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/favicon.svg" alt="" width={26} height={26} />
          <Typography.Title level={4} style={{ margin: 0 }}>
            Aynalytics
          </Typography.Title>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[MENU.find((m) => m.key !== '/' && pathname.startsWith(m.key))?.key ?? '/']}
          items={MENU}
          onClick={({ key }) => navigate(key)}
          style={{ borderInlineEnd: 'none' }}
        />
        {/* Attribution exigee par la licence CC BY 4.0 de la base de geolocalisation. */}
        <Typography.Text type="secondary" style={{ display: 'block', padding: '16px 24px', fontSize: 12 }}>
          <a href="https://db-ip.com" target="_blank" rel="noopener noreferrer">
            IP Geolocation by DB-IP
          </a>
        </Typography.Text>
      </Layout.Sider>
      <Layout>
        {showFilters && (
          <Layout.Header
            style={{
              background: token.colorBgContainer,
              height: 'auto',
              lineHeight: 'normal',
              padding: screens.md ? '12px 24px' : '12px 16px',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              position: 'sticky',
              top: 0,
              zIndex: 10,
            }}
          >
            <FiltersBar />
          </Layout.Header>
        )}
        <Layout.Content style={{ padding: screens.md ? 24 : 16 }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
