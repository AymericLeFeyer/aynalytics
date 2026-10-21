import type { CreatedSite, Site, SiteInput, SitePatch } from '../entities/Site';

export interface SiteRepository {
  list(): Promise<Site[]>;
  create(input: SiteInput): Promise<CreatedSite>;
  update(id: string, patch: SitePatch): Promise<Site>;
  rotateSecret(id: string): Promise<{ secretKey: string }>;
  remove(id: string): Promise<{ deletedEvents: number }>;
}
