import type { PublicSite, SitePatch, SiteRepository } from '@aynalytics/core';
import { DomainError, toPublicSite } from '@aynalytics/core';
import { normalizeName, normalizeOrigins } from './siteValidation';

export interface UpdateSiteInput {
  name?: string;
  allowedOrigins?: string[];
  active?: boolean;
}

export class UpdateSite {
  constructor(private readonly sites: SiteRepository) {}

  execute(id: string, input: UpdateSiteInput): PublicSite {
    const patch: SitePatch = {};
    if (input.name !== undefined) patch.name = normalizeName(input.name);
    if (input.allowedOrigins !== undefined) patch.allowedOrigins = normalizeOrigins(input.allowedOrigins);
    if (input.active !== undefined) patch.active = input.active;
    const site = this.sites.update(id, patch);
    if (!site) throw new DomainError('Site introuvable', 404);
    return toPublicSite(site);
  }
}
