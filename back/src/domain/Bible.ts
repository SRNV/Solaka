export { PaginatedResponse } from './Pagination';

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
  range_from?: string;
  range_to?: string;
  target?: VerseRef;
}

export interface BibleVerse {
  uuid: string;
  number: number;
  content: string;
  related_to: BibleVerseRelation[];
}

export interface BibleChapter {
  number: number;
  alias_protestant: number | null;
  context: string;
  summary: string;
  verses: BibleVerse[];
}

export interface BibleBook {
  name: string;
  number: number;
  alias?: string[];
  author: string;
  author_status: string;
  estimated_date: string;
  to: string;
  context: string;
  chapters: BibleChapter[];
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

export interface BibleBookMeta {
  name: string;
  number: number;
  alias?: string[];
  author: string;
  author_status: string;
  estimated_date: string;
  to: string;
  context: string;
  chapterCount: number;
  chapterNumbers: number[];
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

/** A normalised, deduplicated relation row (direction: from → toFrom–toTo). */
export interface RelRow {
  from:       string;
  toFrom:     string;
  toTo:       string;
  trad:       'c' | 'p';
  relType:    string;
  toFromRef?: { bookName: string; chapterNumber: number; verseNumber: number };
  toToRef?:   { bookName: string; chapterNumber: number; verseNumber: number };
  sourceUrl?: string | null;
  isRange?:   boolean;
}

export interface BibleVerseResult {
  uuid:          string;
  number:        number;
  content:       string;
  bookName:      string;
  chapterNumber: number;
}

export interface BibleChapterResult {
  book:    { name: string; number: number };
  chapter: {
    number:  number;
    summary: string;
    verses:  { uuid: string; number: number; content: string; related_to: RelRow[] }[];
  };
}

export interface BibleStructureEntry {
  name:     string;
  number:   number;
  chapters: { number: number; verseCount: number; uuids: string[]; verseNumbers: number[]; relCount: number }[];
}

export interface SearchHit {
  uuid:    string;
  relType: string;
}
