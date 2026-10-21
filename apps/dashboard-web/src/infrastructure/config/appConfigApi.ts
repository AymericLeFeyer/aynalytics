import type { HttpClient } from '../http/httpClient';

export interface AppConfig {
  /** URL publique du collector (snippets d'integration). */
  collectorUrl: string | null;
}

export const fetchAppConfig = (http: HttpClient) => http.get<AppConfig>('/api/config');
