import { Router } from 'express';
import type { IMagisteriumRepository } from '../../domain/repositories/IMagisteriumRepository';
import {
  GetMagisteriumAuthors,
  GetMagisteriumAuthorBySlug,
  GetMagisteriumDocuments,
  GetMagisteriumCommentsByVerse,
  GetMagisteriumCommentsByDocument,
} from '../../application/useCases/MagisteriumUseCases';

export default function magistereRouter(repo: IMagisteriumRepository): Router {
  const router = Router();

  const getAuthors             = new GetMagisteriumAuthors(repo);
  const getAuthorBySlug        = new GetMagisteriumAuthorBySlug(repo);
  const getDocuments           = new GetMagisteriumDocuments(repo);
  const getCommentsByVerse     = new GetMagisteriumCommentsByVerse(repo);
  const getCommentsByDocument  = new GetMagisteriumCommentsByDocument(repo);

  const getPagination = (req: any) => ({
    limit:  Math.min(parseInt(req.query.limit  as string) || 50, 200),
    offset: parseInt(req.query.offset as string) || 0,
  });

  // GET /api/magistere/authors
  router.get('/authors', (_req, res) => {
    res.json({ data: getAuthors.execute() });
  });

  // GET /api/magistere/authors/:slug
  router.get('/authors/:slug', (req, res) => {
    const author = getAuthorBySlug.execute(req.params.slug);
    if (!author) return res.status(404).json({ error: 'Author not found' });
    res.json(author);
  });

  // GET /api/magistere/authors/:slug/documents
  router.get('/authors/:slug/documents', (req, res) => {
    res.json({ data: getDocuments.execute(req.params.slug) });
  });

  // GET /api/magistere/documents
  // ?author=slug  filter by author
  router.get('/documents', (req, res) => {
    const authorSlug = typeof req.query.author === 'string' ? req.query.author : undefined;
    res.json({ data: getDocuments.execute(authorSlug) });
  });

  // GET /api/magistere/documents/:abbr/comments
  router.get('/documents/:abbr/comments', (req, res) => {
    const { limit, offset } = getPagination(req);
    res.json(getCommentsByDocument.execute(req.params.abbr, limit, offset));
  });

  // GET /api/magistere/verses/:uuid/comments
  router.get('/verses/:uuid/comments', (req, res) => {
    const { limit, offset } = getPagination(req);
    res.json(getCommentsByVerse.execute(req.params.uuid, limit, offset));
  });

  return router;
}
