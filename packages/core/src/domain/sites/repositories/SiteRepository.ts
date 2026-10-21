import type { Site } from '../entities/Site';

export type SitePatch = Partial<Pick<Site, 'name' | 'allowedOrigins' | 'active' | 'secretHash'>>;

export interface SiteRepository {
  list(): Site[];
  findById(id: string): Site | undefined;
  findByPublicKey(publicKey: string): Site | undefined;
  insert(site: Site): void;
  update(id: string, patch: SitePatch): Site | undefined;
  delete(id: string): boolean;
}
