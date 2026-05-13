import 'reflect-metadata';
import { Container, type ResolutionContext } from 'inversify';
import type { Server } from 'http';
import { TYPES } from './types';
import type { AppConfig } from './config';
import type { IBibleRepository } from '../domain/repositories/IBibleRepository';
import type { IGeoMapRepository } from '../domain/repositories/IGeoMapRepository';
import type { IBiblicalPlaceRepository } from '../domain/BiblicalPlace';
import type { ICategoryRepository } from '../domain/repositories/ICategoryRepository';
import type { IObjectionRepository } from '../domain/repositories/IObjectionRepository';
import { JsonBibleStore } from '../infrastructure/JsonBibleStore';
import { JsonObjectionsStore } from '../infrastructure/JsonObjectionsStore';
import { FileGeoMapRepository } from '../infrastructure/FileGeoMapRepository';
import { BiblicalPlaceRepository } from '../infrastructure/BiblicalPlaceRepository';
import { StompServer } from '../infrastructure/StompServer';

export function createContainer(config: AppConfig, httpServer: Server): Container {
  const container = new Container();

  container.bind<AppConfig>(TYPES.Config).toConstantValue(config);
  container.bind<Server>(TYPES.HttpServer).toConstantValue(httpServer);

  container.bind<IBibleRepository>(TYPES.IBibleRepository)
    .to(JsonBibleStore).inSingletonScope();
  container.bind<IGeoMapRepository>(TYPES.IGeoMapRepository)
    .to(FileGeoMapRepository).inSingletonScope();
  container.bind<IBiblicalPlaceRepository>(TYPES.IBiblicalPlaceRepository)
    .to(BiblicalPlaceRepository).inSingletonScope();

  // JsonObjectionsStore exposes two sub-repositories; bind it as a self-singleton
  // then derive ICategoryRepository and IObjectionRepository from it.
  container.bind(JsonObjectionsStore).toSelf().inSingletonScope();
  container.bind<ICategoryRepository>(TYPES.ICategoryRepository)
    .toDynamicValue((ctx: ResolutionContext) => ctx.get(JsonObjectionsStore).categories)
    .inSingletonScope();
  container.bind<IObjectionRepository>(TYPES.IObjectionRepository)
    .toDynamicValue((ctx: ResolutionContext) => ctx.get(JsonObjectionsStore).objections)
    .inSingletonScope();

  container.bind<StompServer>(TYPES.StompServer)
    .to(StompServer).inSingletonScope();

  return container;
}
