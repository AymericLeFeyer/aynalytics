import type { EventProperties, GeoLocation, TrackedEvent } from '../entities/TrackedEvent';
import { computeVisitorHash, mergeUtm, parseUserAgent, resolveSource, sanitizeUrl } from './enrichment';
import type { IncomingEvent } from './payloadSchema';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export interface IngestContext {
  siteId: string;
  ip: string;
  userAgent: string;
  /** Envoi authentifie par cle secrete (backend), sans navigateur. */
  serverSide: boolean;
  receivedAt: number;
  salt: string;
  /** Geolocalisation IP (null : base absente, IP privee ou envoi serveur). */
  geo?: GeoLocation | null;
}

/** Accepte l'horodatage client s'il est plausible (24h en arriere en navigateur, 7j cote serveur). */
export function clampTimestamp(ts: number | undefined, now: number, serverSide: boolean): number {
  if (!ts) return now;
  const maxPast = serverSide ? 7 * DAY : DAY;
  if (ts < now - maxPast || ts > now + 5 * MINUTE) return now;
  return ts;
}

export function buildTrackedEvent(input: IncomingEvent, ctx: IngestContext): TrackedEvent {
  const page = sanitizeUrl(input.url);
  const referrer = sanitizeUrl(input.referrer);
  const utm = mergeUtm(input.utm, page.utm);
  const ua = ctx.serverSide ? { browser: null, os: null, device: null } : parseUserAgent(ctx.userAgent);
  const identity = ctx.serverSide
    ? (input.userId ?? input.anonymousId ?? input.sessionId ?? 'server')
    : `${ctx.ip}|${ctx.userAgent}`;
  const {
    timezone,
    screenHeight,
    viewportWidth,
    viewportHeight,
    pixelRatio,
    colorScheme,
    connection,
    ...extra
  } = input.context ?? {};
  const geo = ctx.serverSide ? null : (ctx.geo ?? null);
  const context: EventProperties = { ...extra };
  if (geo?.latitude != null && geo.longitude != null) {
    context.latitude = geo.latitude;
    context.longitude = geo.longitude;
  }
  const source =
    ctx.serverSide && !utm.source && !referrer.host
      ? 'server'
      : resolveSource({ utmSource: utm.source, referrerHost: referrer.host, pageHost: page.host });

  return {
    siteId: ctx.siteId,
    type: input.type,
    name: input.name,
    properties: input.properties ?? {},
    ts: clampTimestamp(input.ts, ctx.receivedAt, ctx.serverSide),
    receivedAt: ctx.receivedAt,
    visitorHash: computeVisitorHash(ctx.salt, ctx.siteId, identity, ''),
    sessionId: input.sessionId ?? null,
    anonymousId: input.anonymousId ?? null,
    userId: input.userId ?? null,
    url: page.url,
    path: page.path,
    referrer: referrer.url,
    referrerHost: referrer.host,
    source,
    utm,
    browser: ua.browser,
    os: ua.os,
    device: ua.device,
    language: input.language ?? null,
    screenWidth: input.screenWidth ?? null,
    title: input.title?.trim() || null,
    country: geo?.country ?? null,
    region: geo?.region ?? null,
    city: geo?.city ?? null,
    timezone: timezone ?? null,
    screenHeight: screenHeight ?? null,
    viewportWidth: viewportWidth ?? null,
    viewportHeight: viewportHeight ?? null,
    pixelRatio: pixelRatio ?? null,
    colorScheme: colorScheme ?? null,
    connection: connection ?? null,
    context,
  };
}
