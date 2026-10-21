import type { EventRepository, IncomingEvent, SaltRepository, Site } from '@aynalytics/core';
import { buildTrackedEvent, dayKey, isBot } from '@aynalytics/core';

export interface IngestInput {
  site: Site;
  events: IncomingEvent[];
  ip: string;
  userAgent: string;
  serverSide: boolean;
}

export class IngestEvents {
  constructor(
    private readonly events: EventRepository,
    private readonly salts: SaltRepository,
    private readonly clock: () => number = Date.now,
  ) {}

  /** Retourne le nombre d'evenements enregistres (0 si le trafic est identifie comme robot). */
  execute(input: IngestInput): number {
    if (!input.serverSide && isBot(input.userAgent)) return 0;
    const receivedAt = this.clock();
    const salt = this.salts.getOrCreate(dayKey(receivedAt));
    const tracked = input.events.map((event) =>
      buildTrackedEvent(event, {
        siteId: input.site.id,
        ip: input.ip,
        userAgent: input.userAgent,
        serverSide: input.serverSide,
        receivedAt,
        salt,
      }),
    );
    this.events.insertMany(tracked);
    return tracked.length;
  }
}
