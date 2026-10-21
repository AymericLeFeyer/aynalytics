import type { Site } from '@aynalytics/core';
import { isOriginAllowed, verifySecret } from '@aynalytics/core';
import type { SiteRegistry } from '../../sites/SiteRegistry';

export interface AuthorizeInput {
  siteKey: string;
  origin: string | undefined;
  authorization: string | undefined;
}

export type AuthorizeResult =
  | { ok: true; site: Site; serverSide: boolean }
  | { ok: false; reason: 'unknown_site' | 'invalid_secret' | 'origin_not_allowed' };

/**
 * Deux modes :
 * - navigateur : cle publique + header Origin present dans les origines autorisees du site ;
 * - serveur : cle publique + `Authorization: Bearer <cle secrete>` (pas d'Origin requis).
 */
export class AuthorizeCollect {
  constructor(private readonly sites: SiteRegistry) {}

  execute(input: AuthorizeInput): AuthorizeResult {
    const site = this.sites.findByPublicKey(input.siteKey);
    if (!site) return { ok: false, reason: 'unknown_site' };

    const bearer = /^Bearer\s+(\S+)$/i.exec(input.authorization ?? '')?.[1];
    if (bearer) {
      return verifySecret(bearer, site.secretHash)
        ? { ok: true, site, serverSide: true }
        : { ok: false, reason: 'invalid_secret' };
    }

    return isOriginAllowed(input.origin, site.allowedOrigins)
      ? { ok: true, site, serverSide: false }
      : { ok: false, reason: 'origin_not_allowed' };
  }
}
