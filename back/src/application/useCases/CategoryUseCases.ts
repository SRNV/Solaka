import type { ICategoryRepository, CategoryFilters } from '../../models/ICategoryRepository';

export class GetAllCategories {
  constructor(private repo: ICategoryRepository) {}
  execute(filters?: CategoryFilters) { return this.repo.findAll(filters); }
}

export class GetCategoryById {
  constructor(private repo: ICategoryRepository) {}
  execute(uuid: string) { return this.repo.findById(uuid); }
}

export class GetAllSources {
  constructor(private repo: ICategoryRepository) {}
  execute(filters?: CategoryFilters) { return this.repo.findAllSources(filters); }
}

export class GetAllTags {
  constructor(private repo: ICategoryRepository) {}
  execute(filters?: CategoryFilters) { return this.repo.findAllTags(filters); }
}
