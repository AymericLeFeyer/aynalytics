import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import frFR from 'antd/locale/fr_FR';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './index.css';
import { HttpError } from './infrastructure/http/httpClient';
import { ThemeModeProvider, useThemeMode } from './presentation/hooks/useThemeMode';

dayjs.locale('fr');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => !(error instanceof HttpError && error.status < 500) && count < 2,
    },
  },
});

/** Fond du body aligne sur le theme (visible lors du rebond de defilement). */
function BodyBackground() {
  const { token } = theme.useToken();
  useEffect(() => {
    document.body.style.background = token.colorBgLayout;
  }, [token.colorBgLayout]);
  return null;
}

function Root() {
  const { dark } = useThemeMode();
  return (
    <ConfigProvider locale={frFR} theme={{ algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
      <BodyBackground />
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ThemeModeProvider>
      <Root />
    </ThemeModeProvider>
  </StrictMode>,
);
