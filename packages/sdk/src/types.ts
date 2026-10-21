export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type Properties = Record<string, JsonValue>;

export type EventType = 'screen' | 'event';

/**
 * - `session` (defaut) : identifiant de session en sessionStorage, rien de persistant entre visites.
 * - `local` : ajoute un identifiant anonyme persistant (localStorage) -> visiteurs recurrents. Peut necessiter un consentement.
 * - `memory` : aucun stockage navigateur.
 */
export type Persistence = 'session' | 'local' | 'memory';

export interface AynalyticsOptions {
  /** Cle publique du site (`ay_pk_...`), creee dans le dashboard. */
  siteKey: string;
  /** URL du collector, ex : `https://analytics.mondomaine.fr`. */
  endpoint: string;
  /** Trace automatiquement un screen a chaque changement de route (pushState/popstate). */
  autoScreens?: boolean;
  /** Ecoute les clics sur les elements `data-ay-event` (defaut : true). */
  autoClicks?: boolean;
  persistence?: Persistence;
  /** Ne rien envoyer si le navigateur a Do Not Track / Global Privacy Control actif (defaut : false). */
  respectDoNotTrack?: boolean;
  /** Log des envois dans la console. */
  debug?: boolean;
}

export interface WireUtm {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

/** Format d'un evenement sur le reseau (miroir du schema valide par le collector). */
export interface WireEvent {
  type: EventType;
  name: string;
  properties?: Properties;
  ts?: number;
  url?: string;
  referrer?: string;
  utm?: WireUtm;
  sessionId?: string;
  anonymousId?: string;
  userId?: string;
  language?: string;
  screenWidth?: number;
}

export interface CollectPayload {
  siteKey: string;
  events: WireEvent[];
}
