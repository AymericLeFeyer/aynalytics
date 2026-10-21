import { existsSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

/** Sert le build Vite (SPA) avec fallback sur index.html pour les routes front. */
export async function webRoutes(app: FastifyInstance, webDist: string | undefined): Promise<void> {
  const root = webDist ? resolve(webDist) : undefined;
  const hasWeb = !!root && existsSync(join(root, 'index.html'));
  if (hasWeb) {
    await app.register(fastifyStatic, {
      root,
      setHeaders: (res, filePath) => {
        res.setHeader(
          'cache-control',
          filePath.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
        );
      },
    });
  } else {
    app.log.warn({ webDist }, 'build du front introuvable : seule l API est servie');
  }

  app.setNotFoundHandler((request, reply) => {
    if (!hasWeb || request.url.startsWith('/api/') || request.method !== 'GET') {
      return reply.code(404).send({ error: 'Introuvable' });
    }
    return reply.header('cache-control', 'no-cache').sendFile('index.html');
  });
}
