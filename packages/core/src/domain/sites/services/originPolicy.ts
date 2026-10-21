const WILDCARD = '*.';

/**
 * Normalise une origine autorisee saisie par l'utilisateur.
 * Accepte `scheme://host[:port]` ou `scheme://*.domaine[:port]` (http/https uniquement).
 * Retourne null si le motif est invalide (chemin, query, schema exotique...).
 */
export function normalizeOriginPattern(input: string): string | null {
  const value = input.trim().toLowerCase().replace(/\/+$/, '');
  const match = /^(https?):\/\/(.+)$/.exec(value);
  if (!match) return null;
  const [, scheme, rest] = match as unknown as [string, string, string];
  const isWildcard = rest.startsWith(WILDCARD);
  const probeHost = isWildcard ? `x.${rest.slice(WILDCARD.length)}` : rest;
  if (probeHost.includes('*')) return null;
  let url: URL;
  try {
    url = new URL(`${scheme}://${probeHost}`);
  } catch {
    return null;
  }
  // Rejette tout ce qui n'est pas une origine pure (chemin, credentials, query).
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
  const host = isWildcard ? `${WILDCARD}${url.host.slice(2)}` : url.host;
  return `${scheme}://${host}`;
}

/** Verifie qu'un header Origin correspond a l'un des motifs (deja normalises). */
export function isOriginAllowed(origin: string | undefined, patterns: readonly string[]): boolean {
  if (!origin || origin === 'null') return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const normalized = url.origin;
  return patterns.some((pattern) => {
    const [scheme, host] = pattern.split('://') as [string, string];
    if (`${scheme}:` !== url.protocol) return false;
    if (host.startsWith(WILDCARD)) {
      return url.host.endsWith(`.${host.slice(WILDCARD.length)}`);
    }
    return normalized === pattern;
  });
}
