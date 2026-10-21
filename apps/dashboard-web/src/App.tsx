import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './presentation/components/AppLayout';
import { FiltersProvider } from './presentation/hooks/useFilters';
import { EventsPage } from './presentation/pages/EventsPage';
import { OverviewPage } from './presentation/pages/OverviewPage';
import { SitesPage } from './presentation/pages/SitesPage';

export function App() {
  return (
    <FiltersProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="sites" element={<SitesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </FiltersProvider>
  );
}
