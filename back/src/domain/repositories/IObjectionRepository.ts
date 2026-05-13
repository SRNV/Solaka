import { Objection } from '../Objection';
import { PaginatedResponse } from '../Pagination';

export interface ObjectionFilters {
  categoryUuid?: string;
  tag?: string;
  source?: string;
  limit?: number;
  offset?: number;
}

export interface IObjectionRepository {
  findAll(filters?: ObjectionFilters): PaginatedResponse<Objection>;
  findById(uuid: string): Objection | undefined;
}
