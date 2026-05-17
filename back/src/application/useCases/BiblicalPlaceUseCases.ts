import type { IBiblicalPlaceRepository } from '../../models/BiblicalPlace';

export class GetBiblicalPlaces {
  constructor(private repository: IBiblicalPlaceRepository) {}

  async execute() {
    return this.repository.findAll();
  }
}

export class GetBiblicalPlacesByVerse {
  constructor(private repository: IBiblicalPlaceRepository) {}

  async execute(osis: string) {
    return this.repository.findByVerse(osis);
  }
}
