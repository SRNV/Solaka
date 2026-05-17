import type { Category } from './Category';
import type { PaginatedResponse } from './Pagination';

export interface CategoryFilters {
  limit?: number;
  offset?: number;
}

export interface ICategoryRepository {
  findAll(filters?: CategoryFilters): PaginatedResponse<Category>;
  findById(uuid: string): Category | undefined;
  findAllSources(filters?: CategoryFilters): PaginatedResponse<string>;
  findAllTags(filters?: CategoryFilters): PaginatedResponse<string>;
}
