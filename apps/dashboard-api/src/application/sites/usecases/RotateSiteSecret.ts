import type { SiteRepository } from '@aynalytics/core';
import { DomainError, generateSecretKey, hashSecret } from '@aynalytics/core';

/** Regenere la cle secrete (l'ancienne est invalidee des le prochain rafraichissement du collector). */
export class RotateSiteSecret {
  constructor(private readonly sites: SiteRepository) {}

  execute(id: string): { secretKey: string } {
    const secretKey = generateSecretKey();
    const site = this.sites.update(id, { secretHash: hashSecret(secretKey) });
    if (!site) throw new DomainError('Site introuvable', 404);
    return { secretKey };
  }
}
