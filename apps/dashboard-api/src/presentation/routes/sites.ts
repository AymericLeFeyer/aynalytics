import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CreateSite } from '../../application/sites/usecases/CreateSite';
import type { DeleteSite } from '../../application/sites/usecases/DeleteSite';
import type { ListSites } from '../../application/sites/usecases/ListSites';
import type { RotateSiteSecret } from '../../application/sites/usecases/RotateSiteSecret';
import type { UpdateSite } from '../../application/sites/usecases/UpdateSite';

export interface SiteUseCases {
  listSites: ListSites;
  createSite: CreateSite;
  updateSite: UpdateSite;
  rotateSiteSecret: RotateSiteSecret;
  deleteSite: DeleteSite;
}

const origins = z.array(z.string().max(255)).max(50);
const createBody = z.object({ name: z.string(), allowedOrigins: origins });
const updateBody = z.object({
  name: z.string().optional(),
  allowedOrigins: origins.optional(),
  active: z.boolean().optional(),
});
const idParams = z.object({ id: z.string().uuid() });

export function siteRoutes(app: FastifyInstance, useCases: SiteUseCases): void {
  app.get('/api/sites', async () => useCases.listSites.execute());

  app.post('/api/sites', async (request, reply) => {
    const result = useCases.createSite.execute(createBody.parse(request.body));
    return reply.code(201).send(result);
  });

  app.patch('/api/sites/:id', async (request) => {
    const { id } = idParams.parse(request.params);
    return useCases.updateSite.execute(id, updateBody.parse(request.body));
  });

  app.post('/api/sites/:id/rotate-secret', async (request) => {
    const { id } = idParams.parse(request.params);
    return useCases.rotateSiteSecret.execute(id);
  });

  app.delete('/api/sites/:id', async (request) => {
    const { id } = idParams.parse(request.params);
    return useCases.deleteSite.execute(id);
  });
}
