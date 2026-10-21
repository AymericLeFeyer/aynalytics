import type { EventRepository, SaltRepository } from '@aynalytics/core';
import { dayKey } from '@aynalytics/core';

const DAY = 86_400_000;

/** Supprime les sels de plus d'un jour (hash visiteur non recalculable) et les evenements hors retention. */
export class PurgeExpiredData {
  constructor(
    private readonly events: EventRepository,
    private readonly salts: SaltRepository,
    private readonly retentionDays: number,
    private readonly clock: () => number = Date.now,
  ) {}

  execute(): { purgedEvents: number } {
    const now = this.clock();
    this.salts.purgeOlderThan(dayKey(now - DAY));
    const purgedEvents = this.retentionDays > 0 ? this.events.purgeBefore(now - this.retentionDays * DAY) : 0;
    return { purgedEvents };
  }
}
