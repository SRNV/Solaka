import type {
  BibleBookMeta, BibleChapterResult, BibleStructureEntry, BibleVerseResult,
  BibleEvent, HistoricalPeriod, King,
  RelRow, SearchHit, VerseSearchResult,
} from '../Bible';
import type { PaginatedResponse } from '../Pagination';

export interface IBibleRepository {
  readonly ready: boolean;

  // ── Structural queries ────────────────────────────────────────────────────
  getBooks(limit?: number, offset?: number):     PaginatedResponse<BibleBookMeta>;
  getStructure(limit?: number, offset?: number): PaginatedResponse<BibleStructureEntry>;
  getChapter(bookRef: string | number, chapterNum: number): BibleChapterResult | null;
  getVerse(uuid: string): BibleVerseResult | null;

  // ── Ancillary data ────────────────────────────────────────────────────────
  getKings(limit?: number, offset?: number):     PaginatedResponse<King>;
  getPeriods(limit?: number, offset?: number):   PaginatedResponse<HistoricalPeriod>;
  getEvents(limit?: number, offset?: number):    PaginatedResponse<BibleEvent>;

  // ── Relations ─────────────────────────────────────────────────────────────
  getRelations(limit?: number, offset?: number): PaginatedResponse<RelRow>;
  getRelationsByUuids(uuids: string[]):           RelRow[];

  // ── Search ────────────────────────────────────────────────────────────────
  search(query: string, limit?: number, offset?: number): PaginatedResponse<VerseSearchResult>;
  searchHits(query: string): SearchHit[];

  // ── Streaming (generators) ────────────────────────────────────────────────
  iterRelations(trads: Set<'c' | 'p'>, q?: string, from?: string): Iterable<RelRow>;
  searchAll(q: string): Iterable<VerseSearchResult>;

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  warmupChapterCache(): Promise<void>;
}
