import { IGeoMapRepository } from '../../domain/repositories/IGeoMapRepository';

export class GetAllGeoMaps {
  constructor(private repo: IGeoMapRepository) {}
  execute() { return this.repo.findAll(); }
}

export class GetGeoMapById {
  constructor(private repo: IGeoMapRepository) {}
  execute(id: string) { return this.repo.findById(id); }
}
