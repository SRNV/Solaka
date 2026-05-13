export interface VerseRef {
  bookName: string;
  bookNumber: number;
  chapterNumber: number;
  verseNumber: number;
}

export interface BibleVerseRelation {
  from: string;
  to: string;
  relation_source_url: string | null;
  relation_tradition: 'catholic' | 'protestant';
  relation_type: 'authority' | 'citation' | 'typology' | 'fulfillment' | 'allusion' | 'parallel' | 'thematic';
  note?: string;
  type: 'default' | 'range';
  target?: VerseRef;
  rangeFrom?: VerseRef;
  rangeTo?: VerseRef;
}

export interface BibleVerse {
  uuid: string;
  number: number;
  content: string;
  related_to: BibleVerseRelation[];
}

export interface BibleChapterResponse {
  book: { name: string; number: number };
  chapter: {
    number: number;
    alias_protestant: number | null;
    summary: string;
    verses: BibleVerse[];
  };
}

export interface VerseSearchResult {
  uuid: string;
  bookName: string;
  bookNumber: number;
  chapterNumber: number;
  verseNumber: number;
  content: string;
  chapterSummary: string;
}

export interface BibleRelation {
  from:    string;
  fromTo?: string;
  toFrom:  string;
  toTo:    string;
  trad:    'c' | 'p';
  relType?: string;
}

export interface BibleStructureChapter {
  number: number;
  verseCount: number;
  uuids?: string[];
  verseNumbers?: number[];
  relCount?: number;
}

export interface BibleStructureBook {
  name: string;
  number: number;
  chapters: BibleStructureChapter[];
}

export interface BibleBookMeta {
  name: string;
  number: number;
  alias?: string[];
  author: string;
  author_status?: string;
  estimated_date?: string;
  to?: string;
  context?: string;
  chapterCount: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export type BibleCategory =
  | 'pentateuque'
  | 'historiques'
  | 'poetiques'
  | 'prophetiques-majeurs'
  | 'prophetiques-mineurs'
  | 'evangiles'
  | 'actes'
  | 'epitres-pauliniennes'
  | 'epitres-hebreux'
  | 'epitres-catholiques'
  | 'apocalypse';

export interface BibleBookOrder {
  number: number;
  name: string;
  authorPeriod:    [number, number];
  mainComposition: [number, number];
  finalRedaction:  [number, number];
  datation_sources: string[];
}

export interface King {
  name: string;
  aliases: string[];
  birth: number;
  reign: {
    start: number;
    end: number | null;
    duration: number | null;
  };
  death: number;
  saint: boolean;
  kingdom: {
    judah: boolean;
    israel: boolean;
  };
  sources: string[];
}

export interface HistoricalPeriod {
  name: string;
  start: number;
  end: number;
  type: 'domination' | 'exile' | 'period';
}

export interface BibleEvent {
  name: string;
  year: number;
  type: 'covenant' | 'exodus' | 'conquest' | 'monarchy' | 'temple' | 'exile' | 'return' | 'reform' | 'political' | 'birth' | 'death' | 'theological' | 'prophecy' | 'writing' | 'martyrdom' | 'council' | 'revolt' | 'migration' | 'missionary';
  priority: 'major' | 'middle' | 'minor';
  sources: string[];
}

export type HistoricalSubMode = 'authorPeriod' | 'mainComposition' | 'finalRedaction';

export type BookSortMode = 'classic' | 'historical' | 'size';
