import { Router } from 'express';
import type { IPatristicRepository } from '../../domain/repositories/IPatristicRepository';
import {
  GetPatristicAuthors,
  GetPatristicAuthorBySlug,
  GetPatristicCommentsByVerse,
  GetPatristicCommentsByAuthor,
  GetPatristicCommentsBatch,
  GetPatristicCommentIndex,
} from '../../application/useCases/PatristicUseCases';

export default function patristicRouter(repo: IPatristicRepository): Router {
  const router = Router();

  const getAuthors          = new GetPatristicAuthors(repo);
  const getAuthorBySlug     = new GetPatristicAuthorBySlug(repo);
  const getCommentsByVerse  = new GetPatristicCommentsByVerse(repo);
  const getCommentsByAuthor = new GetPatristicCommentsByAuthor(repo);
  const getCommentsBatch    = new GetPatristicCommentsBatch(repo);
  const getCommentIndex     = new GetPatristicCommentIndex(repo);

  const getPagination = (req: any) => ({
    limit:  Math.min(parseInt(req.query.limit  as string) || 50, 200),
    offset: parseInt(req.query.offset as string) || 0,
  });

  // GET /api/patristic/authors
  router.get('/authors', (req, res) => {
    const { limit, offset } = getPagination(req);
    res.json(getAuthors.execute(limit, offset));
  });

  // GET /api/patristic/authors/:slug
  router.get('/authors/:slug', (req, res) => {
    const author = getAuthorBySlug.execute(req.params.slug);
    if (!author) return res.status(404).json({ error: 'Author not found' });
    res.json(author);
  });

  // GET /api/patristic/authors/:slug/comments
  router.get('/authors/:slug/comments', (req, res) => {
    const { limit, offset } = getPagination(req);
    res.json(getCommentsByAuthor.execute(req.params.slug, limit, offset));
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
