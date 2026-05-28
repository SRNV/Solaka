import type {
  BibleBookMeta, BibleChapterResult, BibleStructureEntry, BibleVerseResult,
  BibleEvent, HistoricalPeriod, King,
  RelRow, SearchHit, VerseSearchResult,
} from './Bible';
import type { PaginatedResponse } from './Pagination';

export interface IBibleRepository {
  readonly ready: boolean;

  getBooks(limit?: number, offset?: number):     PaginatedResponse<BibleBookMeta>;
  getStructure(limit?: number, offset?: number): PaginatedResponse<BibleStructureEntry>;
  getChapter(bookRef: string | number, chapterNum: number): BibleChapterResult | null;
  getVerse(uuid: string): BibleVerseResult | null;

  getKings(limit?: number, offset?: number):     PaginatedResponse<King>;
  getPeriods(limit?: number, offset?: number):   PaginatedResponse<HistoricalPeriod>;
  getEvents(limit?: number, offset?: number):    PaginatedResponse<BibleEvent>;

  getRelations(limit?: number, offset?: number): PaginatedResponse<RelRow>;
  getRelationsByUuids(uuids: string[]):           RelRow[];

  search(query: string, limit?: number, offset?: number): PaginatedResponse<VerseSearchResult>;
  searchHits(query: string): SearchHit[];

  getRandomVerses(count: number, books?: string[]): Array<{ uuid: string; bookName: string; chapterNumber: number; verseNumber: number; content: string }>;

  iterRelations(trads: Set<'c' | 'p'>, q?: string, from?: string): Iterable<RelRow>;
  searchAll(q: string): Iterable<VerseSearchResult>;

  warmupChapterCache(): Promise<void>;
}
