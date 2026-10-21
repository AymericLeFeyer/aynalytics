import type { CreatedSite, Site, SiteInput, SitePatch } from '../../../domain/sites/entities/Site';
import type { SiteRepository } from '../../../domain/sites/repositories/SiteRepository';
import type { HttpClient } from '../../http/httpClient';

export class HttpSiteRepository implements SiteRepository {
  constructor(private readonly http: HttpClient) {}

  list() {
    return this.http.get<Site[]>('/api/sites');
  }

  create(input: SiteInput) {
    return this.http.post<CreatedSite>('/api/sites', input);
  }

  update(id: string, patch: SitePatch) {
    return this.http.patch<Site>(`/api/sites/${encodeURIComponent(id)}`, patch);
  }

  rotateSecret(id: string) {
    return this.http.post<{ secretKey: string }>(`/api/sites/${encodeURIComponent(id)}/rotate-secret`);
  }

  remove(id: string) {
    return this.http.delete<{ deletedEvents: number }>(`/api/sites/${encodeURIComponent(id)}`);
  }
}
