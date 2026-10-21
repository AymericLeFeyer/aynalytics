import type { Site, SiteRepository } from '@aynalytics/core';
import { isOriginAllowed } from '@aynalytics/core';

/**
 * Cache memoire des sites actifs. Le dashboard ecrit dans la meme base : un site cree,
 * desactive ou modifie est pris en compte au plus tard apres `ttlMs`.
 */
export class SiteRegistry {
  private byKey = new Map<string, Site>();
  private allOrigins: string[] = [];
  private loadedAt = -Infinity;

  constructor(
    private readonly repository: SiteRepository,
    private readonly ttlMs = 10_000,
    private readonly clock: () => number = Date.now,
  ) {}

  findByPublicKey(publicKey: string): Site | undefined {
    this.refresh();
    return this.byKey.get(publicKey);
  }

  /** Origine autorisee par au moins un site actif (utilise pour les preflights CORS). */
  isKnownOrigin(origin: string | undefined): boolean {
    this.refresh();
    return isOriginAllowed(origin, this.allOrigins);
  }

  private refresh(): void {
    const now = this.clock();
    if (now - this.loadedAt < this.ttlMs) return;
    const sites = this.repository.list().filter((s) => s.active);
    this.byKey = new Map(sites.map((s) => [s.publicKey, s]));
    this.allOrigins = sites.flatMap((s) => s.allowedOrigins);
    this.loadedAt = now;
  }
}
