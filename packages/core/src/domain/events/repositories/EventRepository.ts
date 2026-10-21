import type { GeoLocation, TrackedEvent } from '../entities/TrackedEvent';

/** Geolocalisation IP (implementation : base mmdb). Retourne null si inconnue ou IP privee. */
export interface GeoLocator {
  locate(ip: string): GeoLocation | null;
}

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
