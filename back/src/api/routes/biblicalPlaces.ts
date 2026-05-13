import { Router } from 'express';
import type { IBiblicalPlaceRepository } from '../../domain/BiblicalPlace';
import { GetBiblicalPlaces, GetBiblicalPlacesByVerse } from '../../application/useCases/BiblicalPlaceUseCases';

const router = (repository: IBiblicalPlaceRepository) => {
  const expressRouter = Router();
  const getPlaces = new GetBiblicalPlaces(repository);
  const getPlacesByVerse = new GetBiblicalPlacesByVerse(repository);

  expressRouter.get('/', async (req, res) => {
    try {
      const places = await getPlaces.execute();
      res.json(places);
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  expressRouter.get('/by-verse/:osis', async (req, res) => {
    try {
      const places = await getPlacesByVerse.execute(req.params.osis);
      res.json(places);
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  return expressRouter;
};

export default router;
