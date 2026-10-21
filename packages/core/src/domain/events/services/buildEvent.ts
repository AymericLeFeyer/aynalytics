import type { TrackedEvent } from '../entities/TrackedEvent';
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
  };
}
