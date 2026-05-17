import 'reflect-metadata';
import fs from 'fs';
import { injectable, inject } from 'inversify';
import type {
  BibleBook, BibleBookMeta, BibleVerseRelation, VerseRef, VerseSearchResult,
  PaginatedResponse, King, HistoricalPeriod, BibleEvent,
  RelRow, BibleChapterResult, BibleStructureEntry, BibleVerseResult, SearchHit,
} from '../models/Bible';
import type { IBibleRepository } from '../models/IBibleRepository';
import type { AppConfig } from '../models/config';
import { TYPES } from '../container/types';

// Re-export for consumers that imported RelRow from this file
export type { RelRow };

const REL_PRIORITY: Record<BibleVerseRelation['relation_type'], number> = {
  authority: 0, citation: 1, fulfillment: 2, typology: 3,
  allusion: 4, parallel: 5, thematic: 6,
};
const relPrio = (r: { relation_type?: string; relType?: string }) =>
  REL_PRIORITY[(r.relation_type ?? r.relType ?? '') as BibleVerseRelation['relation_type']] ?? 99;

@injectable()
export class JsonBibleStore implements IBibleRepository {
  private readonly books: BibleBook[];
  private readonly kings: King[];
  private readonly periods: HistoricalPeriod[];
  private readonly events: BibleEvent[];
  private readonly verseIndex  = new Map<string, VerseRef>();
  private readonly byName      = new Map<string, BibleBook>();
  private readonly byNumber    = new Map<number, BibleBook>();
  private readonly relCache:    RelRow[] = [];
  private readonly relByVerse  = new Map<string, RelRow[]>();
  private readonly chapterCache = new Map<string, BibleChapterResult>();
  private _ready = false;
  get ready() { return this._ready; }

  constructor(@inject(TYPES.Config) config: AppConfig) {
    const { biblePath, kingsPath, periodsPath, eventsPath } = config;
    console.log('[Bible] Loading %s …', biblePath);
    const t = Date.now();

    if (!fs.existsSync(biblePath)) {
      throw new Error(`Bible file not found at ${biblePath}`);
    }
    const stats = fs.statSync(biblePath);
    if (stats.isDirectory()) {
      throw new Error(`Bible path ${biblePath} is a directory, expected a file. Check Docker volumes.`);
    }

    this.books = JSON.parse(fs.readFileSync(biblePath, 'utf-8')) as BibleBook[];

    console.log('[Bible] Loading %s …', kingsPath);
    try {
      this.kings = JSON.parse(fs.readFileSync(kingsPath, 'utf-8')) as King[];
    } catch (e) {
      console.error('[Bible] Failed to load kings:', e);
      this.kings = [];
    }

    console.log('[Bible] Loading %s …', periodsPath);
    try {
      this.periods = JSON.parse(fs.readFileSync(periodsPath, 'utf-8')) as HistoricalPeriod[];
    } catch (e) {
      console.error('[Bible] Failed to load periods:', e);
      this.periods = [];
    }

    console.log('[Bible] Loading %s …', eventsPath);
    try {
      this.events = JSON.parse(fs.readFileSync(eventsPath, 'utf-8')) as BibleEvent[];
    } catch (e) {
      console.error('[Bible] Failed to load events:', e);
      this.events = [];
    }

    console.log('[Bible] Parsed in %ds, indexing…', ((Date.now() - t) / 1000).toFixed(1));

    for (const book of this.books) {
      this.byNumber.set(book.number, book);
      this.byName.set(this.norm(book.name), book);
      for (const alias of book.alias ?? []) this.byName.set(this.norm(alias), book);

      for (const ch of book.chapters) {
        for (const v of ch.verses) {
          this.verseIndex.set(v.uuid, {
            bookName:      book.name,
            bookNumber:    book.number,
            chapterNumber: ch.number,
            verseNumber:   v.number,
          });
        }
      }
    }
    console.log('[Bible] Ready — %d verses indexed in %ds, precomputing relations…',
      this.verseIndex.size, ((Date.now() - t) / 1000).toFixed(1));

    const seen = new Set<string>();
    for (const book of this.books) {
      for (const ch of book.chapters) {
        for (const v of ch.verses) {
          for (const r of v.related_to) {
            let toFrom: string;
            let toTo:   string;
            if (r.type === 'range') {
              if (!r.range_from || !r.range_to) continue;
              toFrom = r.range_from; toTo = r.range_to;
            } else {
              toFrom = r.to; toTo = r.to;
            }
            const vf = this.verseIndex.get(toFrom);
            const vt = this.verseIndex.get(toTo);
            if (!vf || !vt) continue;
            if (book.number === vf.bookNumber && ch.number === vf.chapterNumber &&
                book.number === vt.bookNumber && ch.number === vt.chapterNumber) continue;
            const trad  = r.relation_tradition === 'catholic' ? 'c' : ('p' as 'c' | 'p');
            const isRange = toFrom !== toTo;
            const key   = isRange
              ? `R|${v.uuid}|${toFrom}|${toTo}|${trad}`
              : `D|${v.uuid < toFrom ? `${v.uuid}|${toFrom}` : `${toFrom}|${v.uuid}`}|${trad}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const row: RelRow = { from: v.uuid, toFrom, toTo, trad, relType: r.relation_type };
            this.relCache.push(row);
            
            const addRel = (u: string) => {
              if (!this.relByVerse.has(u)) this.relByVerse.set(u, []);
              this.relByVerse.get(u)!.push(row);
            };
            addRel(v.uuid);
            addRel(toFrom);
            if (toTo !== toFrom) addRel(toTo);
          }
        }
      }
    }
    this.relCache.sort((a, b) => relPrio(a) - relPrio(b));
    // Also sort per-verse relations for consistency
    for (const rels of this.relByVerse.values()) {
      rels.sort((a, b) => relPrio(a) - relPrio(b));
    }
    console.log('[Bible] %d unique relations cached in %ds. Ready.',
      this.relCache.length, ((Date.now() - t) / 1000).toFixed(1));
    this._ready = true;
  }

  private norm(s: string) {
    return s
      .toLowerCase()
      .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[‘’ʼ]/g, "'")
      .replace(/\s+/g, ' ').trim();
  }

  private parseRef(raw: string): { book: BibleBook; chapter: number; verse?: number; verseTo?: number } | null {
    const m = raw.trim().match(/^(.+?)\s+(\d+)(?::(\d+)(?:[–\-](\d+))?)?$/);
    if (!m) return null;
    const [, bookRaw, ch, v, vTo] = m;
    const book = this.findBook(bookRaw);
    if (!book) return null;
    return {
      book,
      chapter: parseInt(ch, 10),
      verse: v ? parseInt(v, 10) : undefined,
      verseTo: vTo ? parseInt(vTo, 10) : undefined,
    };
  }

  search(query: string, limit = 50, offset = 0): PaginatedResponse<VerseSearchResult> {
    const allResults: VerseSearchResult[] = [];
    const seen = new Set<string>();
    for (const r of this.iterSearch(query)) {
      if (!seen.has(r.uuid)) { seen.add(r.uuid); allResults.push(r); }
    }
    return { data: allResults.slice(offset, offset + limit), total: allResults.length, limit, offset };
  }

  /** Itère les résultats d'une recherche.
   *  Chaque partie séparée par ";" est indépendante (union) :
   *  - si c'est une référence (ex: "Jean 1:2") → retourne ce(s) verset(s) exactement
   *  - si c'est du texte (ex: "ange du Seigneur") → cherche dans tous les livres
   */
  *iterSearch(query: string): Generator<VerseSearchResult> {
    type RefFilter = { book: BibleBook; chapter: number; verse?: number; verseTo?: number };
    const parts = query.split(';').map(p => p.trim()).filter(p => p.length > 0);
    if (parts.length === 0) return;

    const refFilters: RefFilter[] = [];
    const textGroups: string[][] = [];

    for (const p of parts) {
      const ref = this.parseRef(p);
      if (ref) {
        refFilters.push(ref);
      } else {
        const nt = this.norm(p);
        if (nt.length >= 2) {
          const words = nt.split(/\s+/).filter(w => w.length >= 2);
          textGroups.push(words.length > 0 ? words : [nt]);
        }
      }
    }

    if (refFilters.length === 0 && textGroups.length === 0) return;

    const seen = new Set<string>();

    // Phase 1 — ref-based matches (O(1) lookups via byName/byNumber)
    for (const filter of refFilters) {
      const book = filter.book;
      for (const ch of book.chapters) {
        if (ch.number !== filter.chapter) continue;
        const summary = ch.summary ?? '';
        for (const v of ch.verses) {
          if (filter.verse !== undefined) {
            const vEnd = filter.verseTo ?? filter.verse;
            if (v.number < filter.verse || v.number > vEnd) continue;
          }
          if (seen.has(v.uuid)) continue;
          seen.add(v.uuid);
          yield { uuid: v.uuid, bookName: book.name, bookNumber: book.number,
                  chapterNumber: ch.number, verseNumber: v.number,
                  content: v.content, chapterSummary: summary };
        }
      }
    }

    // Phase 2 — text-based matches (scan all books, deduplicated)
    if (textGroups.length > 0) {
      for (const book of this.books) {
        for (const ch of book.chapters) {
          const summary = ch.summary ?? '';
          for (const v of ch.verses) {
            if (seen.has(v.uuid)) continue;
            const nc = this.norm(v.content);
            if (!textGroups.some(words => words.every(w => nc.includes(w)))) continue;
            seen.add(v.uuid);
            yield { uuid: v.uuid, bookName: book.name, bookNumber: book.number,
                    chapterNumber: ch.number, verseNumber: v.number,
                    content: v.content, chapterSummary: summary };
          }
        }
      }
    }
  }

  /** Retourne les UUIDs des versets matchant + leur relType prioritaire (pour coloration sur la map) */
  searchHits(query: string): SearchHit[] {
    const result: Array<{ uuid: string; relType: string }> = [];
    for (const r of this.iterSearch(query)) {
      const rels = this.relByVerse.get(r.uuid);
      const relType = rels && rels.length > 0 ? rels[0].relType : '';
      result.push({ uuid: r.uuid, relType });
    }
    return result;
  }


  private findBook(ref: string | number): BibleBook | undefined {
    return typeof ref === 'number'
      ? this.byNumber.get(ref)
      : this.byName.get(this.norm(ref)) ?? this.byNumber.get(Number(ref));
  }

  private enrichRel(r: RelRow): RelRow {
    const toFromRef = this.verseIndex.get(r.toFrom);
    const toToRef   = r.toTo !== r.toFrom ? this.verseIndex.get(r.toTo) : toFromRef;
    return {
      ...r,
      toFromRef: toFromRef ? { bookName: toFromRef.bookName, chapterNumber: toFromRef.chapterNumber, verseNumber: toFromRef.verseNumber } : undefined,
      toToRef:   toToRef   ? { bookName: toToRef.bookName,   chapterNumber: toToRef.chapterNumber,   verseNumber: toToRef.verseNumber   } : undefined,
      isRange: r.toFrom !== r.toTo,
    };
  }

  /** Itère les relations filtrées par tradition pour le streaming STOMP */
  *iterRelations(trads: Set<'c' | 'p'>, q?: string, from?: string): Generator<RelRow> {
    if (from) {
      const rels = this.relByVerse.get(from) ?? [];
      for (const r of rels) {
        if (trads.has(r.trad) && r.from === from) yield this.enrichRel(r);
      }
      return;
    }

    if (!q) {
      for (const r of this.relCache) {
        if (trads.has(r.trad)) yield this.enrichRel(r);
      }
      return;
    }

    const seenRels = new Set<string>();
    for (const hit of this.iterSearch(q)) {
      const rels = this.relByVerse.get(hit.uuid);
      if (!rels) continue;
      for (const r of rels) {
        if (!trads.has(r.trad)) continue;
        const key = `${r.from}|${r.toFrom}|${r.toTo}|${r.trad}`;
        if (seenRels.has(key)) continue;
        seenRels.add(key);
        yield this.enrichRel(r);
      }
    }
  }

  getVerse(uuid: string): BibleVerseResult | null {
    const ref = this.verseIndex.get(uuid);
    if (!ref) return null;
    const book = this.byName.get(this.norm(ref.bookName));
    if (!book) return null;
    const ch = book.chapters.find(c => c.number === ref.chapterNumber);
    const v  = ch?.verses.find(v => v.uuid === uuid);
    if (!v) return null;
    return { uuid: v.uuid, number: v.number, content: v.content, bookName: ref.bookName, chapterNumber: ref.chapterNumber };
  }

  /** Retourne tous les résultats d'une recherche sans limite (pour STOMP) */
  *searchAll(q: string): Generator<VerseSearchResult> {
    yield* this.iterSearch(q);
  }

  getRelationsByUuids(uuids: string[]): RelRow[] {
    const seen = new Set<string>();
    const result: RelRow[] = [];
    for (const uuid of uuids) {
      const rels = this.relByVerse.get(uuid);
      if (!rels) continue;
      for (const r of rels) {
        const key = `${r.from}|${r.toFrom}|${r.toTo}|${r.trad}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(this.enrichRel(r));
      }
    }
    return result;
  }

  getRelations(limit = 1000, offset = 0): PaginatedResponse<RelRow> {
    return {
      data:   this.relCache.slice(offset, offset + limit),
      total:  this.relCache.length,
      limit,
      offset,
    };
  }

  getStructure(limit = 100, offset = 0): PaginatedResponse<BibleStructureEntry> {
    const all = this.books.map((b, i) => ({
      name:     b.name,
      number:   i,          // global 0-based index matching book-order.json
      chapters: b.chapters.map(ch => ({
        number:       ch.number,
        verseCount:   ch.verses.length,
        uuids:        ch.verses.map(v => v.uuid),
        verseNumbers: ch.verses.map(v => v.number),
        relCount:     ch.verses.reduce((s, v) => s + v.related_to.length, 0),
      })),
    }));
    return {
      data:  all.slice(offset, offset + limit),
      total: all.length,
      limit,
      offset,
    };
  }

  getBooks(limit = 100, offset = 0): PaginatedResponse<BibleBookMeta> {
    const all = this.books.map(b => ({
      name: b.name, number: b.number, alias: b.alias,
      author: b.author, author_status: b.author_status,
      estimated_date: b.estimated_date, to: b.to, context: b.context,
      chapterCount:   b.chapters.length,
      chapterNumbers: b.chapters.map(c => c.number),
    }));
    return {
      data:  all.slice(offset, offset + limit),
      total: all.length,
      limit,
      offset,
    };
  }

  getKings(limit = 100, offset = 0): PaginatedResponse<King> {
    return {
      data:  this.kings.slice(offset, offset + limit),
      total: this.kings.length,
      limit,
      offset,
    };
  }

  getPeriods(limit = 100, offset = 0): PaginatedResponse<HistoricalPeriod> {
    return {
      data:  this.periods.slice(offset, offset + limit),
      total: this.periods.length,
      limit,
      offset,
    };
  }

  getEvents(limit = 200, offset = 0): PaginatedResponse<BibleEvent> {
    return {
      data:  this.events.slice(offset, offset + limit),
      total: this.events.length,
      limit,
      offset,
    };
  }

  private buildChapter(book: BibleBook, ch: BibleBook['chapters'][0]): BibleChapterResult {
    const verses = ch.verses.map(v => ({
      uuid:      v.uuid,
      number:    v.number,
      content:   v.content,
      related_to: (this.relByVerse.get(v.uuid) ?? [])
        .filter(r => r.from === v.uuid)
        .map(r => this.enrichRel(r)),
    }));
    return { book: { name: book.name, number: book.number }, chapter: { number: ch.number, summary: ch.summary, verses } };
  }

  async warmupChapterCache() {
    const t = Date.now();
    const total = this.books.reduce((s, b) => s + b.chapters.length, 0);
    let done = 0;
    let lastPct = -1;

    for (const book of this.books) {
      for (const ch of book.chapters) {
        const key = `${book.name}|${ch.number}`;
        if (!this.chapterCache.has(key)) {
          this.chapterCache.set(key, this.buildChapter(book, ch));
        }
        done++;
        const pct = Math.floor((done / total) * 100);
        if (pct !== lastPct && pct % 10 === 0) {
          lastPct = pct;
          console.log('[Bible] chapterCache %d%% (%d/%d) — %ds', pct, done, total, ((Date.now() - t) / 1000).toFixed(1));
        }
      }
      await new Promise(r => setImmediate(r));
    }
    console.log('[Bible] chapterCache ready — %d chapters in %ds.',
      this.chapterCache.size, ((Date.now() - t) / 1000).toFixed(1));
  }

  getChapter(bookRef: string | number, chapterNum: number) {
    const book = this.findBook(bookRef);
    if (!book) return null;
    const key = `${book.name}|${chapterNum}`;
    if (!this.chapterCache.has(key)) {
      const ch = book.chapters.find(c => c.number === chapterNum);
      if (!ch) return null;
      this.chapterCache.set(key, this.buildChapter(book, ch));
    }
    return this.chapterCache.get(key) ?? null;
  }

  invalidateChapter(bookRef: string | number, chapterNum: number) {
    const book = this.findBook(bookRef);
    if (!book) return;
    const ch = book.chapters.find(c => c.number === chapterNum);
    if (!ch) return;
    this.chapterCache.set(`${book.name}|${chapterNum}`, this.buildChapter(book, ch));
  }
}
