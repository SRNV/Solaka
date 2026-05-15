export { PaginatedResponse } from './Pagination';

export interface PatristicPerson {
  uuid: string;
  slug: string;
  nameFr: string;
  nameEn: string;
  nameLa?: string;
  abbreviations: string[];
  born: number;
  died: number;
  tradition: string;
  type: 'patristic' | 'magistere';
}

export interface PatristicCommentSource {
  name: string;
  position?: number;
  date?: number;
  publication_date?: number;
}

export interface PatristicComment {
  uuid: string;
  personUuid: string;
  collection: string;
  sourceUrl: string;
  sourceWork?: string;
  source?: PatristicCommentSource;
  text: string;
  verseFromUuid: string;
  verseToUuid: string;
}

export interface PatristicCommentResult extends PatristicComment {
  person: PatristicPerson;
}

export interface PatristicPersonSnippet {
  slug: string;
  nameFr: string;
  tradition: string;
  type: 'patristic' | 'magistere';
}

export interface CommentSummary {
  count: number;
  persons: PatristicPersonSnippet[];
}
