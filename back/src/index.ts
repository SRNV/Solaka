import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import { createServer } from 'http';
import type { IBibleRepository } from './models/IBibleRepository';
import type { IGeoMapRepository } from './models/IGeoMapRepository';
import type { IBiblicalPlaceRepository } from './models/BiblicalPlace';
import type { ICategoryRepository } from './models/ICategoryRepository';
import type { IObjectionRepository } from './models/IObjectionRepository';
import type { IPatristicRepository } from './models/IPatristicRepository';
import type { IMagisteriumRepository } from './models/IMagisteriumRepository';
import { createContainer } from './container/container';
import type { AppConfig } from './models/config';
import { TYPES } from './container/types';
import { StompServer } from './infrastructure/StompServer';
import bibleRouter from './api/routes/bible';
import categoriesRouter from './api/routes/categories';
import objectionsRouter from './api/routes/objections';
import geomapRouter from './api/routes/geomap';
import biblicalPlacesRouter from './api/routes/biblicalPlaces';
import patristicRouter from './api/routes/patristic';
import magistereRouter from './api/routes/magistere';
import apostlesRouter from './api/routes/apostles';

const config: AppConfig = {
  dataPath:               process.env.DATA_PATH               ?? path.resolve(__dirname, '../../../objections.json'),
  biblePath:              process.env.BIBLE_PATH              ?? path.resolve(__dirname, '../../../scrapp/output/bible.json'),
  kingsPath:              process.env.KINGS_PATH              ?? path.resolve(__dirname, '../../../scrapp/output/kings.json'),
  periodsPath:            process.env.PERIODS_PATH            ?? path.resolve(__dirname, '../../../scrapp/output/periods.json'),
  eventsPath:             process.env.EVENTS_PATH             ?? path.resolve(__dirname, '../../../scrapp/output/events.json'),
  geomapPath:             process.env.GEOMAP_PATH             ?? path.resolve(__dirname, '../data/geojson'),
  biblicalDataPath:       process.env.BIBLICAL_DATA_PATH      ?? path.resolve(__dirname, '../data/biblical-geocoding'),
  patristicPersonsPath:   process.env.PATRISTIC_PERSONS_PATH  ?? path.resolve(__dirname, '../../../scrapp/output/persons.json'),
  patristicCommentsPath:  process.env.PATRISTIC_COMMENTS_PATH ?? path.resolve(__dirname, '../../../scrapp/output/comments.json'),
  magisterePersonsPath:   process.env.MAGISTERE_PERSONS_PATH  ?? path.resolve(__dirname, '../../../scrapp/output/magistere_persons.json'),
  magistereCommentsPath:  process.env.MAGISTERE_COMMENTS_PATH ?? path.resolve(__dirname, '../../../scrapp/output/magistere_comments.json'),
  port:                   Number(process.env.PORT ?? 3001),
  corsOrigin:             process.env.CORS_ORIGIN             ?? '*',
};

const app = express();
app.use(compression());

const corsOrigin = config.corsOrigin.includes(',') 
  ? config.corsOrigin.split(',') 
  : config.corsOrigin;

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

const httpServer = createServer(app);
const container  = createContainer(config, httpServer);

const bible      = container.get<IBibleRepository>(TYPES.IBibleRepository);
const catRepo    = container.get<ICategoryRepository>(TYPES.ICategoryRepository);
const objRepo    = container.get<IObjectionRepository>(TYPES.IObjectionRepository);
const geomap     = container.get<IGeoMapRepository>(TYPES.IGeoMapRepository);
const bgd        = container.get<IBiblicalPlaceRepository>(TYPES.IBiblicalPlaceRepository);
const patristic  = container.get<IPatristicRepository>(TYPES.IPatristicRepository);
const magistere  = container.get<IMagisteriumRepository>(TYPES.IMagisteriumRepository);

app.use('/api/bible',            bibleRouter(bible));
app.use('/api/categories',       categoriesRouter(catRepo, objRepo));
app.use('/api/objections',       objectionsRouter(objRepo));
app.use('/api/geomap',           geomapRouter(geomap));
app.use('/api/biblical-places',  biblicalPlacesRouter(bgd));
app.use('/api/patristic',        patristicRouter(patristic));
app.use('/api/magistere',        magistereRouter(magistere));
app.use('/api/apostles',         apostlesRouter(config.geomapPath));

app.get('/api/health', (_req, res) => {
  if (!bible.ready) return res.status(503).json({ status: 'warming up' });
  res.json({ status: 'ok' });
});

// Instancie StompServer (effet de bord : démarre le WebSocket)
container.get<StompServer>(TYPES.StompServer);

httpServer.listen(config.port, () => {
  console.log(`API listening on :${config.port}`);
  bible.warmupChapterCache();
});
