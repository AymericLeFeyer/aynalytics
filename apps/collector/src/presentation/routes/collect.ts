import { collectPayloadSchema } from '@aynalytics/core';
import type { FastifyInstance } from 'fastify';
import type { AuthorizeCollect } from '../../application/ingest/usecases/AuthorizeCollect';
import type { IngestEvents } from '../../application/ingest/usecases/IngestEvents';
import type { SiteRegistry } from '../../application/sites/SiteRegistry';

interface CollectRouteDeps {
  registry: SiteRegistry;
  authorize: AuthorizeCollect;
  ingest: IngestEvents;
  rateLimitPerMinute: number;
}

export function collectRoutes(app: FastifyInstance, deps: CollectRouteDeps): void {
  // Preflight : uniquement pour une origine connue. Le SDK envoie en text/plain (requete simple),
  // le preflight ne sert qu'aux integrations qui envoient du JSON depuis un navigateur.
  app.options('/v1/collect', async (request, reply) => {
    if (!deps.registry.isKnownOrigin(request.headers.origin)) return reply.code(403).send();
    return reply
      .headers({
        'access-control-allow-methods': 'POST',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '86400',
      })
      .code(204)
      .send();
  });

  app.post(
    '/v1/collect',
    {
      // Route a fort volume : pas de log par requete (seuls les refus et erreurs sont logges).
      logLevel: 'warn',
      config: { rateLimit: { max: deps.rateLimitPerMinute, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = collectPayloadSchema.safeParse(request.body);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return reply.code(400).send({
          error: 'invalid_payload',
          detail: issue ? `${issue.path.join('.')}: ${issue.message}` : undefined,
        });
      }

      const auth = deps.authorize.execute({
        siteKey: parsed.data.siteKey,
        origin: request.headers.origin,
        authorization: request.headers.authorization,
      });
      if (!auth.ok) {
        request.log.warn({ reason: auth.reason, origin: request.headers.origin }, 'collect refuse');
        return reply.code(403).send({ error: auth.reason });
      }

      const accepted = deps.ingest.execute({
        site: auth.site,
        events: parsed.data.events,
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? '',
        serverSide: auth.serverSide,
      });
      return reply.code(202).send({ accepted });
    },
  );
}
