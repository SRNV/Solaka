export { PaginatedResponse } from './Pagination';

export interface MagisteriumPerson {
  slug: string;
  name: string;
  type: 'pope' | 'council' | 'dicastery';
  tradition: 'catholic';
  pontificate_start?: number;
  pontificate_end?: number | null;
  birth_year?: number;
  death_year?: number | null;
  council_start?: number;
  council_end?: number;
}

export interface MagisteriumComment {
  person_slug: string;
  document_name: string;
  document_abbr: string;
  document_url: string;
  paragraph?: number;
  year: number;
  text: string;
  verse_uuids: string[];
}

export interface MagisteriumCommentResult extends MagisteriumComment {
  person: MagisteriumPerson;
}

export interface MagisteriumDocument {
  name: string;
  abbr: string;
  url: string;
  year: number;
  person_slug: string;
  comment_count: number;
}
