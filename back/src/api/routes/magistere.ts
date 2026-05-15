import { Router } from 'express';
import type { IMagisteriumRepository } from '../../domain/repositories/IMagisteriumRepository';
import {
  GetMagisteriumPersons,
  GetMagisteriumPersonBySlug,
  GetMagisteriumDocuments,
  GetMagisteriumCommentsByVerse,
  GetMagisteriumCommentsByDocument,
} from '../../application/useCases/MagisteriumUseCases';

export default function magistereRouter(repo: IMagisteriumRepository): Router {
  const router = Router();

  const getPersons             = new GetMagisteriumPersons(repo);
  const getPersonBySlug        = new GetMagisteriumPersonBySlug(repo);
  const getDocuments           = new GetMagisteriumDocuments(repo);
  const getCommentsByVerse     = new GetMagisteriumCommentsByVerse(repo);
  const getCommentsByDocument  = new GetMagisteriumCommentsByDocument(repo);

  const getPagination = (req: any) => ({
    limit:  Math.min(parseInt(req.query.limit  as string) || 50, 200),
    offset: parseInt(req.query.offset as string) || 0,
  });

  // GET /api/magistere/persons
  router.get('/persons', (_req, res) => {
    res.json({ data: getPersons.execute() });
  });

  // GET /api/magistere/persons/:slug
  router.get('/persons/:slug', (req, res) => {
    const person = getPersonBySlug.execute(req.params.slug);
    if (!person) return res.status(404).json({ error: 'Person not found' });
    res.json(person);
  });

  // GET /api/magistere/persons/:slug/documents
  router.get('/persons/:slug/documents', (req, res) => {
    res.json({ data: getDocuments.execute(req.params.slug) });
  });

  // GET /api/magistere/documents
  // ?person=slug  filter by person
  router.get('/documents', (req, res) => {
    const personSlug = typeof req.query.person === 'string' ? req.query.person : undefined;
    res.json({ data: getDocuments.execute(personSlug) });
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
