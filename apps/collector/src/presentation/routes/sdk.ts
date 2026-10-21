import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

const SDK_BUNDLE = 'aynalytics.global.js';

/** Sert le SDK navigateur (IIFE) sur /sdk.js, chargeable depuis n'importe quel site. */
export function sdkRoutes(app: FastifyInstance, sdkDir: string | undefined): void {
  let bundle: Buffer | null = null;
  if (sdkDir) {
    try {
      bundle = readFileSync(join(sdkDir, SDK_BUNDLE));
    } catch {
      app.log.warn(
        { sdkDir },
        'bundle SDK introuvable : /sdk.js renverra 404 (lancer `npm run build -w @aynalytics/sdk`)',
      );
    }
  }

  app.get('/sdk.js', { logLevel: 'warn' }, async (_request, reply) => {
    if (!bundle) return reply.code(404).send({ error: 'not_found' });
    return reply
      .headers({
        'content-type': 'application/javascript; charset=utf-8',
        'cache-control': 'public, max-age=3600',
        'cross-origin-resource-policy': 'cross-origin',
      })
      .send(bundle);
  });
}
