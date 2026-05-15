export interface PatristicPersonSnippet {
  slug:      string;
  nameFr:    string;
  tradition: string;
  type:      'patristic' | 'magistere';
}

export interface CommentSummary {
  count:   number;
  persons: PatristicPersonSnippet[];
}

export type CommentBatchResult = Record<string, CommentSummary>;

export interface PatristicCommentResult {
  uuid:          string;
  personUuid:    string;
  collection:    string;
  sourceUrl:     string;
  sourceWork?:   string;
  text:          string;
  verseFromUuid: string;
  verseToUuid:   string;
  person: {
    uuid:      string;
    slug:      string;
    nameFr:    string;
    nameEn:    string;
    tradition: string;
    type:      'patristic' | 'magistere';
    born?:     number;
    died?:     number;
  };
}

export interface PatristicCommentsPage {
  data:   PatristicCommentResult[];
  total:  number;
  limit:  number;
  offset: number;
}
