import type { MagisteriumAuthor, MagisteriumCommentResult, MagisteriumDocument } from '../Magisterium';
import type { PaginatedResponse } from '../Pagination';

export interface IMagisteriumRepository {
  getAuthors(): MagisteriumAuthor[];
  getAuthorBySlug(slug: string): MagisteriumAuthor | null;

  getDocuments(authorSlug?: string): MagisteriumDocument[];

  getCommentsByVerse(
    verseUuid: string,
    limit?: number,
    offset?: number,
  ): PaginatedResponse<MagisteriumCommentResult>;

  getCommentsByDocument(
    abbr: string,
    limit?: number,
    offset?: number,
  ): PaginatedResponse<MagisteriumCommentResult>;
}
