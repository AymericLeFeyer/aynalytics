import { createHash } from 'node:crypto';
import type { Utm } from '../entities/TrackedEvent';

const UTM_KEYS = ['source', 'medium', 'campaign', 'term', 'content'] as const;

export interface SanitizedUrl {
  url: string | null;
  path: string | null;
  host: string | null;
  utm: Utm;
}

export const emptyUtm = (): Utm => ({
  source: null,
  medium: null,
  campaign: null,
  term: null,
  content: null,
});

/**
 * Nettoie une URL : http(s) uniquement, sans fragment ni query string,
 * a l'exception des parametres utm_* (evite de stocker des tokens passes en query).
 */
export function sanitizeUrl(raw: string | undefined): SanitizedUrl {
  const utm = emptyUtm();
  const empty: SanitizedUrl = { url: null, path: null, host: null, utm };
  if (!raw) return empty;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return empty;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return empty;
  const kept = new URLSearchParams();
  for (const key of UTM_KEYS) {
    const value = url.searchParams.get(`utm_${key}`)?.slice(0, 200);
    if (value) {
      utm[key] = value;
      kept.set(`utm_${key}`, value);
    }
  }
  const query = kept.toString();
  return {
    url: `${url.origin}${url.pathname}${query ? `?${query}` : ''}`,
    path: url.pathname,
    host: url.hostname,
    utm,
  };
}

/** Les UTM explicites (persistes en session par le SDK) priment sur ceux de l'URL courante. */
export function mergeUtm(primary: Partial<Record<keyof Utm, string>> | undefined, fallback: Utm): Utm {
  const merged = { ...fallback };
  for (const key of UTM_KEYS) {
    const value = primary?.[key]?.trim();
    if (value) merged[key] = value;
  }
  return merged;
}

const stripWww = (host: string): string => host.replace(/^www\./, '');

/** Source d'acquisition : utm_source > domaine referent externe > `direct`. */
export function resolveSource(input: {
  utmSource: string | null;
  referrerHost: string | null;
  pageHost: string | null;
}): string {
  if (input.utmSource) return input.utmSource.toLowerCase();
  if (input.referrerHost && (!input.pageHost || stripWww(input.referrerHost) !== stripWww(input.pageHost))) {
    return stripWww(input.referrerHost);
  }
  return 'direct';
}

const BOT_RE =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|curl|wget|python-requests|httpclient|go-http|java\/|phantom|selenium|puppeteer|playwright/i;

export const isBot = (userAgent: string): boolean => userAgent.trim() === '' || BOT_RE.test(userAgent);

export interface UserAgentInfo {
  browser: string | null;
  os: string | null;
  device: string | null;
}

const BROWSERS: [RegExp, string][] = [
  [/edg\//i, 'Edge'],
  [/opr\/|opera/i, 'Opera'],
  [/samsungbrowser/i, 'Samsung Internet'],
  [/firefox|fxios/i, 'Firefox'],
  [/chrome|crios|chromium/i, 'Chrome'],
  [/safari/i, 'Safari'],
];
const SYSTEMS: [RegExp, string][] = [
  [/windows/i, 'Windows'],
  [/iphone|ipad|ipod/i, 'iOS'],
  [/android/i, 'Android'],
  [/mac os x|macintosh/i, 'macOS'],
  [/cros/i, 'ChromeOS'],
  [/linux/i, 'Linux'],
];
const firstMatch = (ua: string, table: [RegExp, string][]): string =>
  table.find(([re]) => re.test(ua))?.[1] ?? 'Other';

/** Classification legere du User-Agent (le UA brut n'est jamais stocke). */
export function parseUserAgent(ua: string): UserAgentInfo {
  if (!ua) return { browser: null, os: null, device: null };
  const device = /ipad|tablet/i.test(ua)
    ? 'tablet'
    : /mobi|iphone|ipod/i.test(ua)
      ? 'mobile'
      : /android/i.test(ua)
        ? 'tablet'
        : 'desktop';
  return { browser: firstMatch(ua, BROWSERS), os: firstMatch(ua, SYSTEMS), device };
}

/** Hash visiteur anonyme : change chaque jour (sel tournant), ne permet pas de retrouver l'IP. */
export function computeVisitorHash(salt: string, siteId: string, ip: string, userAgent: string): string {
  return createHash('sha256').update(`${salt}|${siteId}|${ip}|${userAgent}`).digest('hex').slice(0, 32);
}

export const dayKey = (timestamp: number): string => new Date(timestamp).toISOString().slice(0, 10);
