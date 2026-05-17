import type { LeanVerse } from './bible';
import type { CommentSummary } from './patristic';

export interface StoredVerse {
  uuid:    string;
  number:  number;
  content: string;
}

export interface VerseRef {
  bookName: string;
  chapterNumber: number;
  verseNumber: number;
}

export interface RelRow {
  from:       string;
  toFrom:     string;
  toTo:       string;
  trad:       'c' | 'p';
  relType:    string;
  toFromRef?: VerseRef;
  toToRef?:   VerseRef;
  isRange?:   boolean;
  sourceUrl?: string | null;
}

export interface RelationsState {
  rels:   Record<string, RelRow>;
  byFrom: Record<string, string[]>;
  addBatch: (batch: RelRow[]) => void;
}

export interface PatristicCommentState {
  summaries: Map<string, CommentSummary>;
  mergeSummaries: (entries: [string, CommentSummary][]) => void;
}

export interface CommentModalTarget {
  verseIdx:   number;
  verses:     LeanVerse[];
  bookName:   string;
  chapterNum: number;
}

export interface CommentModalStore {
  target: CommentModalTarget | null;
  open:   (t: CommentModalTarget) => void;
  close:  () => void;
}
