import type { BibleTarget } from '@/contexts/BibleDrawerContext.tsx';
import type { BibleBookMeta } from '@/models/bible';

export function normBook(s: string) {
  return s
    .toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/\s+/g, ' ').trim();
}

export function parseRef(raw: string, books: BibleBookMeta[]): BibleTarget | null {
  const m = raw.trim().match(/^(.+?)\s+(\d+)(?::(\d+)(?:[–\-](\d+))?)?$/);
  if (!m) return null;
  const [, bookRaw, ch, v, vTo] = m;
  const bn = normBook(bookRaw);
  const book = books.find(b => normBook(b.name) === bn || b.alias?.some(a => normBook(a) === bn));
  if (!book) return null;
  return {
    book:    book.name,
    chapter: parseInt(ch, 10),
    verse:   v   ? parseInt(v,   10) : undefined,
    verseTo: vTo ? parseInt(vTo, 10) : undefined,
  };
}
