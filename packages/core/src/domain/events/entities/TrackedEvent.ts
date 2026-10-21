export type EventType = 'screen' | 'event';
export const EVENT_TYPES: readonly EventType[] = ['screen', 'event'];

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type EventProperties = Record<string, JsonValue>;

export interface Utm {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
}

/** Evenement enrichi, pret a etre persiste. */
export interface TrackedEvent {
  siteId: string;
  type: EventType;
  name: string;
  properties: EventProperties;
  /** Horodatage de l'evenement (ms, borne cote serveur). */
  ts: number;
  receivedAt: number;
  /** Hash anonyme journalier (sel tournant + site + IP + UA). Aucune IP stockee. */
  visitorHash: string;
  sessionId: string | null;
  anonymousId: string | null;
  userId: string | null;
  url: string | null;
  path: string | null;
  referrer: string | null;
  referrerHost: string | null;
  /** utm_source > domaine referent externe > `direct` (ou `server` pour les envois serveur). */
  source: string;
  utm: Utm;
  browser: string | null;
  os: string | null;
  device: string | null;
  language: string | null;
  screenWidth: number | null;
}

export interface StoredEvent extends TrackedEvent {
  id: number;
}
