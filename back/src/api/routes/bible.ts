import { Router } from 'express';
import type { IBibleRepository } from '../../models/IBibleRepository';
import {
  GetBooks, GetStructure, GetChapter, GetVerse,
  GetKings, GetPeriods, GetEvents,
  GetRelations, GetRelationsByUuids,
  SearchBible, SearchBibleHits,
} from '../../application/useCases/BibleUseCases';
import bookOrderData from '../../data/book-order.json';

export default function bibleRouter(repo: IBibleRepository): Router {
  const router = Router();

  const getBooks           = new GetBooks(repo);
  const getStructure       = new GetStructure(repo);
  const getChapter         = new GetChapter(repo);
  const getVerse           = new GetVerse(repo);
  const getKings           = new GetKings(repo);
  const getPeriods         = new GetPeriods(repo);
  const getEvents          = new GetEvents(repo);
  const getRelations       = new GetRelations(repo);
  const getRelsByUuids     = new GetRelationsByUuids(repo);
  const searchBible        = new SearchBible(repo);
  const searchBibleHits    = new SearchBibleHits(repo);

  const getPagination = (req: any) => ({
    limit:  parseInt(req.query.limit  as string) || 50,
    offset: parseInt(req.query.offset as string) || 0,
  });

  // GET /api/bible/book-order
  router.get('/book-order', (req, res) => {
    const { limit, offset } = getPagination(req);
    res.json({ data: bookOrderData.slice(offset, offset + limit), total: bookOrderData.length, limit, offset });
  });

  // GET /api/bible/relations
  router.get('/relations', (req, res) => {
    const { limit, offset } = getPagination(req);
    res.json(getRelations.execute(limit, offset));
  });

  // POST /api/bible/relations/batch
  router.post('/relations/batch', (req, res) => {
    const { uuids } = req.body as { uuids?: unknown };
    if (!Array.isArray(uuids) || uuids.length === 0)
      return res.status(400).json({ error: 'uuids must be a non-empty array' });
    if (uuids.length > 500)
      return res.status(400).json({ error: 'uuids exceeds maximum of 500' });
    res.json({ data: getRelsByUuids.execute(uuids as string[]) });
  });

  // GET /api/bible/structure
  router.get('/structure', (req, res) => {
    const { limit, offset } = getPagination(req);
    res.json(getStructure.execute(limit, offset));
  });

  // GET /api/bible/books
  router.get('/books', (req, res) => {
    const { limit, offset } = getPagination(req);
    res.json(getBooks.execute(limit, offset));
  });

  // GET /api/bible/kings
  router.get('/kings', (req, res) => {
    const { limit, offset } = getPagination(req);
    res.json(getKings.execute(limit, offset));
  });

  // GET /api/bible/periods
  router.get('/periods', (req, res) => {
    const { limit, offset } = getPagination(req);
    res.json(getPeriods.execute(limit, offset));
  });

  // GET /api/bible/events
  router.get('/events', (req, res) => {
    const { limit, offset } = getPagination(req);
    res.json(getEvents.execute(limit, offset));
  });

  // GET /api/bible/search?q=word
  router.get('/search', (req, res) => {
    const q = (typeof req.query.q === 'string' ? req.query.q : '').trim();
    if (q.length < 2) return res.json({ data: [], total: 0, limit: 50, offset: 0 });
    const { limit, offset } = getPagination(req);
    res.json(searchBible.execute(q, limit, offset));
  });

  // GET /api/bible/search/hits?q=word
  router.get('/search/hits', (req, res) => {
    const q = (typeof req.query.q === 'string' ? req.query.q : '').trim();
    if (q.length < 2) return res.json({ data: [] });
    res.json({ data: searchBibleHits.execute(q) });
  });

  // GET /api/bible/books/:book/chapters/:chapter
  router.get('/books/:book/chapters/:chapter', (req, res) => {
    const chNum = parseInt(req.params.chapter);
    if (isNaN(chNum)) return res.status(400).json({ error: 'Invalid chapter' });
    const bookRef = isNaN(Number(req.params.book))
      ? decodeURIComponent(req.params.book)
      : Number(req.params.book);
    const result = getChapter.execute(bookRef, chNum);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  });

  // GET /api/bible/verses/:uuid
  router.get('/verses/:uuid', (req, res) => {
    const result = getVerse.execute(req.params.uuid);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  });

  return router;
}
