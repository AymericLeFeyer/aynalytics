import type { PublicSite, SiteRepository } from '@aynalytics/core';
import { toPublicSite } from '@aynalytics/core';

export class ListSites {
  constructor(private readonly sites: SiteRepository) {}

  execute(): PublicSite[] {
    return this.sites.list().map(toPublicSite);
  }
}
