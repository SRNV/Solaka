export const TYPES = {
  Config:                   Symbol.for('Config'),
  IBibleRepository:         Symbol.for('IBibleRepository'),
  IObjectionRepository:     Symbol.for('IObjectionRepository'),
  ICategoryRepository:      Symbol.for('ICategoryRepository'),
  IGeoMapRepository:        Symbol.for('IGeoMapRepository'),
  IBiblicalPlaceRepository: Symbol.for('IBiblicalPlaceRepository'),
  HttpServer:               Symbol.for('HttpServer'),
  StompServer:              Symbol.for('StompServer'),
} as const;
