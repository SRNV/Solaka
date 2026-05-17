import 'reflect-metadata';
import fs from 'fs';
import { injectable, inject } from 'inversify';
import type { Category } from '../models/Category';
import type { Objection } from '../models/Objection';
import type { PaginatedResponse } from '../models/Pagination';
import type { ICategoryRepository, CategoryFilters } from '../models/ICategoryRepository';
import type { IObjectionRepository, ObjectionFilters } from '../models/IObjectionRepository';
import type { AppConfig } from '../models/config';
import { TYPES } from '../container/types';

class CategoryStore implements ICategoryRepository {
  constructor(private readonly data: Category[]) {}

  findAll(filters: CategoryFilters = {}): PaginatedResponse<Category> {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    return {
      data: this.data.slice(offset, offset + limit),
      total: this.data.length,
      limit,
      offset,
    };
  }

  findById(uuid: string): Category | undefined {
    return this.data.find(c => c.uuid === uuid);
  }

  findAllSources(filters: CategoryFilters = {}): PaginatedResponse<string> {
    const sources = [...new Set(this.data.map(c => c.from))];
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    return {
      data: sources.slice(offset, offset + limit),
      total: sources.length,
      limit,
      offset,
    };
  }

  findAllTags(filters: CategoryFilters = {}): PaginatedResponse<string> {
    const tags = [...new Set(this.data.flatMap(c => c.tags))].sort();
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    return {
      data: tags.slice(offset, offset + limit),
      total: tags.length,
      limit,
      offset,
    };
  }
}

class ObjectionStore implements IObjectionRepository {
  constructor(private readonly data: Objection[]) {}

  findAll(filters: ObjectionFilters = {}): PaginatedResponse<Objection> {
    const filtered = this.data.filter(o => {
      if (filters.categoryUuid && o.category.uuid !== filters.categoryUuid) return false;
      if (filters.source && o.category.from !== filters.source) return false;
      if (filters.tag && !o.category.tags.includes(filters.tag)) return false;
      return true;
    });

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    return {
      data: filtered.slice(offset, offset + limit),
      total: filtered.length,
      limit,
      offset,
    };
  }

  findById(uuid: string): Objection | undefined {
    return this.data.find(o => o.uuid === uuid);
  }
}

@injectable()
export class JsonObjectionsStore {
  readonly categories: ICategoryRepository;
  readonly objections: IObjectionRepository;

  constructor(@inject(TYPES.Config) config: AppConfig) {
    const raw  = fs.readFileSync(config.dataPath, 'utf-8');
    const data = JSON.parse(raw) as { categories: Category[]; objections: Objection[] };
    console.log(`Loaded ${data.categories.length} categories, ${data.objections.length} objections.`);
    this.categories = new CategoryStore(data.categories);
    this.objections = new ObjectionStore(data.objections);
  }
}
