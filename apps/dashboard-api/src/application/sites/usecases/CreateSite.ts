import { randomUUID } from 'node:crypto';
import type { PublicSite, Site, SiteRepository } from '@aynalytics/core';
import { generatePublicKey, generateSecretKey, hashSecret, toPublicSite } from '@aynalytics/core';
import { normalizeName, normalizeOrigins } from './siteValidation';

export interface CreateSiteInput {
  name: string;
  allowedOrigins: string[];
}

/** Cree un site. La cle secrete est renvoyee une seule fois (seul son hash est stocke). */
export class CreateSite {
  constructor(private readonly sites: SiteRepository) {}

  execute(input: CreateSiteInput): { site: PublicSite; secretKey: string } {
    const secretKey = generateSecretKey();
    const site: Site = {
      id: randomUUID(),
      name: normalizeName(input.name),
      publicKey: generatePublicKey(),
      secretHash: hashSecret(secretKey),
      allowedOrigins: normalizeOrigins(input.allowedOrigins),
      active: true,
      createdAt: Date.now(),
    };
    this.sites.insert(site);
    return { site: toPublicSite(site), secretKey };
  }
}
