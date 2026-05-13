import { Router } from 'express';
import { IObjectionRepository } from '../../domain/repositories/IObjectionRepository';
import { GetAllObjections, GetObjectionById } from '../../application/useCases/ObjectionUseCases';

export default function objectionsRouter(repo: IObjectionRepository): Router {
  const router = Router();
  const getAll  = new GetAllObjections(repo);
  const getById = new GetObjectionById(repo);

  const getPagination = (req: any) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    return { limit, offset };
  };

  // GET /api/objections?source=protestant&tag=marie&category=uuid&limit=50&offset=0
  router.get('/', (req, res) => {
    const { source, tag, category } = req.query as Record<string, string>;
    const { limit, offset } = getPagination(req);
    res.json(getAll.execute({
      source:       source   || undefined,
      tag:          tag      || undefined,
      categoryUuid: category || undefined,
      limit,
      offset,
    }));
  });

  router.get('/sources/:source', (req, res) => {
    const { limit, offset } = getPagination(req);
    res.json(getAll.execute({ source: req.params.source, limit, offset }));
  });

  router.get('/tags/:tag', (req, res) => {
    const { limit, offset } = getPagination(req);
    res.json(getAll.execute({ tag: req.params.tag, limit, offset }));
  });

  router.get('/:uuid', (req, res) => {
    const obj = getById.execute(req.params.uuid);
    if (!obj) return res.status(404).json({ error: 'Objection not found' });
    res.json(obj);
  });

  return router;
}
