import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

const SDK_BUNDLE = 'aynalytics.global.js';

/** Sert le SDK navigateur (IIFE) sur /sdk.js, chargeable depuis n'importe quel site. */
export function sdkRoutes(app: FastifyInstance, sdkDir: string | undefined): void {
  let bundle: Buffer | null = null;
  let etag = '';
  if (sdkDir) {
    try {
      bundle = readFileSync(join(sdkDir, SDK_BUNDLE));
      etag = `"${createHash('sha256').update(bundle).digest('base64url').slice(0, 16)}"`;
    } catch {
      app.log.warn(
        { sdkDir },
        'bundle SDK introuvable : /sdk.js renverra 404 (lancer `npm run build -w @aynalytics/sdk`)',
      );
    }
  }

  app.get('/sdk.js', { logLevel: 'warn' }, async (request, reply) => {
    if (!bundle) return reply.code(404).send({ error: 'not_found' });
    // Cache court + ETag : une nouvelle version du SDK atteint les visiteurs en 5 min max,
    // et la revalidation ne coute qu'un 304.
    reply.headers({
      'cache-control': 'public, max-age=300, stale-while-revalidate=86400',
      etag,
      'cross-origin-resource-policy': 'cross-origin',
    });
    if (request.headers['if-none-match'] === etag) return reply.code(304).send();
    return reply.header('content-type', 'application/javascript; charset=utf-8').send(bundle);
  });
}
