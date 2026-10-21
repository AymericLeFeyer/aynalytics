import type { FastifyError, FastifyInstance } from 'fastify';
import type { SiteRegistry } from '../../application/sites/SiteRegistry';

/** Headers de durcissement + CORS restreint aux origines declarees par les sites actifs. */
export function registerSecurity(app: FastifyInstance, registry: SiteRegistry): void {
  app.addHook('onRequest', async (request, reply) => {
    reply.headers({
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'x-frame-options': 'DENY',
      'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    });
    const origin = request.headers.origin;
    if (origin && registry.isKnownOrigin(origin)) {
      reply.header('access-control-allow-origin', origin);
      reply.header('vary', 'Origin');
    }
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500) {
      request.log.error(error);
      return reply.code(500).send({ error: 'internal_error' });
    }
    return reply
      .code(status)
      .send({ error: status === 429 ? 'rate_limited' : (error.code ?? 'bad_request') });
  });

  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: 'not_found' }));
}
