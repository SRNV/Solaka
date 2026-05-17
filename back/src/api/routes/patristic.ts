import { Router } from 'express';
import type { IPatristicRepository } from '../../models/IPatristicRepository';
import {
  GetPatristicPersons,
  GetPatristicPersonBySlug,
  GetPatristicCommentsByVerse,
  GetPatristicCommentsByPerson,
  GetPatristicCommentsBatch,
  GetPatristicCommentIndex,
} from '../../application/useCases/PatristicUseCases';

export default function patristicRouter(repo: IPatristicRepository): Router {
  const router = Router();

  const getPersons          = new GetPatristicPersons(repo);
  const getPersonBySlug     = new GetPatristicPersonBySlug(repo);
  const getCommentsByVerse  = new GetPatristicCommentsByVerse(repo);
  const getCommentsByPerson = new GetPatristicCommentsByPerson(repo);
  const getCommentsBatch    = new GetPatristicCommentsBatch(repo);
  const getCommentIndex     = new GetPatristicCommentIndex(repo);

  const getPagination = (req: any) => ({
    limit:  Math.min(parseInt(req.query.limit  as string) || 50, 200),
    offset: parseInt(req.query.offset as string) || 0,
  });

  // GET /api/patristic/persons
  router.get('/persons', (req, res) => {
    const { limit, offset } = getPagination(req);
    res.json(getPersons.execute(limit, offset));
  });

  // GET /api/patristic/persons/:slug
  router.get('/persons/:slug', (req, res) => {
    const person = getPersonBySlug.execute(req.params.slug);
    if (!person) return res.status(404).json({ error: 'Person not found' });
    res.json(person);
  });

  // GET /api/patristic/persons/:slug/comments
  router.get('/persons/:slug/comments', (req, res) => {
    const { limit, offset } = getPagination(req);
    res.json(getCommentsByPerson.execute(req.params.slug, limit, offset));
  });

  // GET /api/patristic/verses/:uuid/comments
  router.get('/verses/:uuid/comments', (req, res) => {
    const { limit, offset } = getPagination(req);
    res.json(getCommentsByVerse.execute(req.params.uuid, limit, offset));
  });

  // GET /api/patristic/comment-index
  router.get('/comment-index', (_req, res) => {
    res.json(getCommentIndex.execute());
  });

  // POST /api/patristic/verses/comments/batch
  router.post('/verses/comments/batch', (req, res) => {
    const { uuids } = req.body;
    if (!Array.isArray(uuids)) return res.status(400).json({ error: 'uuids must be an array' });
    res.json(getCommentsBatch.execute(uuids as string[]));
  });

  return router;
}
