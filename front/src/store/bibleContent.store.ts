import type { StoredVerse } from '@/models/stores';

export type { StoredVerse };

const verseCache   = new Map<string, StoredVerse>();
const chapterCache = new Map<string, string[]>();   // "${book}|${chapter}" → uuid[]

const chapterKey = (book: string, chapter: number) => `${book}|${chapter}`;

export const bibleContentCache = {
  // ── Verses ────────────────────────────────────────────────────
  getVerse:  (uuid: string) => verseCache.get(uuid),
  hasVerse:  (uuid: string) => verseCache.has(uuid),
  setVerse:  (v: StoredVerse) => verseCache.set(v.uuid, v),
  setVerses: (vs: StoredVerse[]) => vs.forEach(v => verseCache.set(v.uuid, v)),

  // ── Chapter UUID lists ────────────────────────────────────────
  getChapterUuids: (book: string, chapter: number) =>
    chapterCache.get(chapterKey(book, chapter)),
  setChapterUuids: (book: string, chapter: number, uuids: string[]) =>
    chapterCache.set(chapterKey(book, chapter), uuids),
  hasChapter: (book: string, chapter: number) =>
    chapterCache.has(chapterKey(book, chapter)),
};
