import type { PatristicPerson, PatristicCommentResult, CommentSummary } from '../Patristic';
import type { PaginatedResponse } from '../Pagination';

export interface IPatristicRepository {
  getPersons(limit?: number, offset?: number): PaginatedResponse<PatristicPerson>;
  getPersonBySlug(slug: string): PatristicPerson | null;

  getCommentsByVerse(
    verseUuid: string,
    limit?: number,
    offset?: number,
  ): PaginatedResponse<PatristicCommentResult>;

  getCommentsByPerson(
    slug: string,
    limit?: number,
    offset?: number,
  ): PaginatedResponse<PatristicCommentResult>;

  getCommentsBatch(verseUuids: string[]): Record<string, CommentSummary>;
  getCommentIndex(): Record<string, CommentSummary>;
}
