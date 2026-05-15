import type { MagisteriumPerson, MagisteriumCommentResult, MagisteriumDocument } from '../Magisterium';
import type { PaginatedResponse } from '../Pagination';

export interface IMagisteriumRepository {
  getPersons(): MagisteriumPerson[];
  getPersonBySlug(slug: string): MagisteriumPerson | null;

  getDocuments(personSlug?: string): MagisteriumDocument[];

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
