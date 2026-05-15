export interface PatristicAuthorSnippet {
  slug:      string;
  nameFr:    string;
  tradition: string;
  type:      'patristic' | 'magistere';
}

export interface CommentSummary {
  count:   number;
  authors: PatristicAuthorSnippet[];
}

export type CommentBatchResult = Record<string, CommentSummary>;

export interface PatristicCommentResult {
  uuid:          string;
  authorUuid:    string;
  collection:    string;
  sourceUrl:     string;
  sourceWork?:   string;
  text:          string;
  verseFromUuid: string;
  verseToUuid:   string;
  author: {
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
