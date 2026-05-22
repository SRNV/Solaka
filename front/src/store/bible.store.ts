import { fetchOnce } from './apiCache.ts';
import type { PaginatedResponse } from '@/models/bible';
import type { BibleBookMeta, King, HistoricalPeriod, BibleEvent } from '@/models/bible';

export interface GameVerse {
  uuid: string;
  bookName: string;
  chapterNumber: number;
  verseNumber: number;
  content: string;
}

// ── helpers ────────────────────────────────────────────────────────────────

async function fetchAllPages<T>(baseUrl: string): Promise<T[]> {
  let all: T[] = [];
  let offset   = 0;
  const limit  = 1000;

  while (true) {
    const sep = baseUrl.includes('?') ? '&' : '?';
    const url = `${baseUrl}${sep}offset=${offset}&limit=${limit}`;
    const res = await fetchOnce<PaginatedResponse<T>>(url);
    all = [...all, ...res.data];
    if (all.length >= res.total || res.data.length === 0) break;
    offset += limit;
  }
  return all;
}

// ── public API ─────────────────────────────────────────────────────────────

export const bibleStore = {
  books:     () => fetchAllPages<BibleBookMeta>('/api/bible/books'),
  structure: () => fetchAllPages<unknown>('/api/bible/structure'),
  bookOrder: () => fetchAllPages<unknown>('/api/bible/book-order'),
  kings:     () => fetchAllPages<King>('/api/bible/kings'),
  periods:   () => fetchAllPages<HistoricalPeriod>('/api/bible/periods'),
  events:    () => fetchAllPages<BibleEvent>('/api/bible/events'),
  relations: () => fetchAllPages<unknown>('/api/bible/relations'),

  chapter: (book: string, chapter: number) =>
    fetchOnce<unknown>(
      `/api/bible/books/${encodeURIComponent(book)}/chapters/${chapter}`,
    ),

  search: (q: string, limit = 50, offset = 0) =>
    fetchOnce<unknown>(
      `/api/bible/search?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`,
    ),

  randomVerses: (count = 60) =>
    fetchOnce<GameVerse[]>(`/api/bible/random?count=${count}`),
};
