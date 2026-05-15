import type { PatristicAuthor, PatristicCommentResult, CommentSummary } from '../Patristic';
import type { PaginatedResponse } from '../Pagination';

export interface IPatristicRepository {
  getAuthors(limit?: number, offset?: number): PaginatedResponse<PatristicAuthor>;
  getAuthorBySlug(slug: string): PatristicAuthor | null;

  getCommentsByVerse(
    verseUuid: string,
    limit?: number,
    offset?: number,
  ): PaginatedResponse<PatristicCommentResult>;

  getCommentsByAuthor(
    slug: string,
    limit?: number,
    offset?: number,
  ): PaginatedResponse<PatristicCommentResult>;

  getCommentsBatch(verseUuids: string[]): Record<string, CommentSummary>;
  getCommentIndex(): Record<string, CommentSummary>;
}
