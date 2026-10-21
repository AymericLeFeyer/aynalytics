import type { TrackedEvent } from '../entities/TrackedEvent';

export interface EventRepository {
  insertMany(events: TrackedEvent[]): void;
  /** Supprime les evenements recus avant `timestamp`. Retourne le nombre supprime. */
  purgeBefore(timestamp: number): number;
  deleteBySite(siteId: string): number;
}

/** Sel journalier partage par les instances, pour le hash visiteur. */
export interface SaltRepository {
  getOrCreate(day: string): string;
  purgeOlderThan(day: string): void;
}
