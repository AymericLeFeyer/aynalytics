import { createHash, timingSafeEqual } from 'node:crypto';
import { DomainError } from '@aynalytics/core';
import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

export const CSRF_HEADER = 'x-aynalytics-csrf';
const PUBLIC_PATHS = new Set(['/api/health']);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // antd injecte ses styles (CSS-in-JS) : 'unsafe-inline' requis pour les styles uniquement.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

const sha256 = (value: string): Buffer => createHash('sha256').update(value).digest();

/**
 * Defense en profondeur (le dashboard est deja derriere le VPN) :
 * basic auth a temps constant, anti-CSRF sur les mutations, headers de durcissement.
 */
export function registerSecurity(
  app: FastifyInstance,
  credentials: { user: string; password: string },
): void {
  const expected = sha256(`${credentials.user}:${credentials.password}`);

  app.addHook('onRequest', async (request, reply) => {
    reply.headers({
      'content-security-policy': CSP,
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-resource-policy': 'same-origin',
    });

    if (PUBLIC_PATHS.has(request.url)) return;

    const header = request.headers.authorization ?? '';
    const given = header.startsWith('Basic ') ? Buffer.from(header.slice(6), 'base64').toString('utf8') : '';
    if (!timingSafeEqual(sha256(given), expected)) {
      return reply
        .code(401)
        .header('www-authenticate', 'Basic realm="aynalytics", charset="UTF-8"')
        .send({ error: 'unauthorized' });
    }

    // Basic auth = identifiants renvoyes automatiquement par le navigateur : on bloque le CSRF
    // en exigeant un header custom (impossible a poser depuis un autre site sans preflight).
    if (!SAFE_METHODS.has(request.method)) {
      const fetchSite = request.headers['sec-fetch-site'];
      const sameSite = !fetchSite || fetchSite === 'same-origin' || fetchSite === 'none';
      if (request.headers[CSRF_HEADER] !== '1' || !sameSite) {
        return reply.code(403).send({ error: 'csrf' });
      }
    }
  });

  app.setErrorHandler((error: FastifyError | Error, request, reply) => {
    if (error instanceof DomainError) return reply.code(error.status).send({ error: error.message });
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      return reply.code(400).send({
        error: issue ? `${issue.path.join('.') || 'requête'} : ${issue.message}` : 'Requête invalide',
      });
    }
    const status = 'statusCode' in error && error.statusCode ? error.statusCode : 500;
    if (status >= 500) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Erreur interne' });
    }
    return reply.code(status).send({ error: error.message });
  });
}
