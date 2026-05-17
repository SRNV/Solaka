import { Router } from 'express';
import type { ICategoryRepository } from '../../models/ICategoryRepository';
import type { IObjectionRepository } from '../../models/IObjectionRepository';
import { GetAllCategories, GetCategoryById, GetAllSources, GetAllTags } from '../../application/useCases/CategoryUseCases';
import { GetAllObjections } from '../../application/useCases/ObjectionUseCases';

export default function categoriesRouter(
  catRepo: ICategoryRepository,
  objRepo: IObjectionRepository,
): Router {
  const router = Router();
  const getAll        = new GetAllCategories(catRepo);
  const getById       = new GetCategoryById(catRepo);
  const getSources    = new GetAllSources(catRepo);
  const getTags       = new GetAllTags(catRepo);
  const getObjections = new GetAllObjections(objRepo);

  const getPagination = (req: any) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    return { limit, offset };
  };

  router.get('/', (req, res) => {
    const { limit, offset } = getPagination(req);
    res.json(getAll.execute({ limit, offset }));
  });

  router.get('/sources', (req, res) => {
    const { limit, offset } = getPagination(req);
    res.json(getSources.execute({ limit, offset }));
  });

  router.get('/tags', (req, res) => {
    const { limit, offset } = getPagination(req);
    res.json(getTags.execute({ limit, offset }));
  });

  router.get('/:uuid', (req, res) => {
    const cat = getById.execute(req.params.uuid);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    res.json(cat);
  });

  router.get('/:uuid/objections', (req, res) => {
    const { limit, offset } = getPagination(req);
    res.json(getObjections.execute({ categoryUuid: req.params.uuid, limit, offset }));
  });

  return router;
}
