import { Router } from 'express';
import { IGeoMapRepository } from '../../domain/repositories/IGeoMapRepository';
import { GetAllGeoMaps, GetGeoMapById } from '../../application/useCases/GeoMapUseCases';

export default function geomapRouter(repo: IGeoMapRepository): Router {
  const router = Router();
  const getAll  = new GetAllGeoMaps(repo);
  const getById = new GetGeoMapById(repo);

  // GET /api/geomap → liste triée par année
  router.get('/', (_req, res) => {
    res.json(getAll.execute());
  });

  // GET /api/geomap/:id → FeatureCollection GeoJSON
  router.get('/:id', (req, res) => {
    const data = getById.execute(req.params.id);
    if (!data) return res.status(404).json({ error: 'GeoMap not found' });
    res.json(data);
  });

  // POST /api/geomap/batch → { id1: data1, id2: data2 }
  router.post('/batch', (req, res) => {
    const ids = req.body.ids;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });
    
    // Limitation à 10 items
    const targetIds = ids.slice(0, 10);
    const result: Record<string, any> = {};
    
    for (const id of targetIds) {
      const data = getById.execute(id);
      if (data) result[id] = data;
    }
    
    res.json(result);
  });

  return router;
}
