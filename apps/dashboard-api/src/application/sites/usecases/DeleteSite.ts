import type { EventRepository, SiteRepository } from '@aynalytics/core';
import { DomainError } from '@aynalytics/core';

/** Supprime le site et tous ses evenements (irreversible). */
export class DeleteSite {
  constructor(
    private readonly sites: SiteRepository,
    private readonly events: EventRepository,
  ) {}

  execute(id: string): { deletedEvents: number } {
    if (!this.sites.findById(id)) throw new DomainError('Site introuvable', 404);
    this.sites.delete(id);
    return { deletedEvents: this.events.deleteBySite(id) };
  }
}
