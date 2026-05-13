import { IObjectionRepository, ObjectionFilters } from '../../domain/repositories/IObjectionRepository';

export class GetAllObjections {
  constructor(private repo: IObjectionRepository) {}
  execute(filters?: ObjectionFilters) { return this.repo.findAll(filters); }
}

export class GetObjectionById {
  constructor(private repo: IObjectionRepository) {}
  execute(uuid: string) { return this.repo.findById(uuid); }
}
