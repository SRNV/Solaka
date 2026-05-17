import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBibleDrawer } from '@/contexts/BibleDrawerContext.tsx';
import { useApi } from '@/hooks/useApi.ts';
import { parseRef } from '@/utils/bibleRef.ts';
import type { BibleBookMeta, BibleChapterResponse, VerseSearchResult, PaginatedResponse } from '@/models/bible';
import type { BibleTarget } from '@/contexts/BibleDrawerContext.tsx';
import styles from './SearchPage.module.css';

/* ── Highlight ───────────────────────────────────────────────── */

function normStr(s: string) {
  return s
    .toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[''ʼ]/g, "'");
}

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const nText  = normStr(text);
  const nTerms = terms.map(t => normStr(t.trim())).filter(Boolean);
  if (!nTerms.length) return <>{text}</>;

  type Span = { start: number; end: number };
  const spans: Span[] = [];
  for (const nt of nTerms) {
    let i = nText.indexOf(nt);
    while (i !== -1) { spans.push({ start: i, end: i + nt.length }); i = nText.indexOf(nt, i + 1); }
  }
  if (!spans.length) return <>{text}</>;

  spans.sort((a, b) => a.start - b.start);
  const merged: Span[] = [spans[0]];
  for (let i = 1; i < spans.length; i++) {
    const last = merged[merged.length - 1];
    if (spans[i].start <= last.end) last.end = Math.max(last.end, spans[i].end);
    else merged.push(spans[i]);
  }

  const parts: React.ReactNode[] = [];
  let pos = 0;
  for (const { start, end } of merged) {
    if (start > pos) parts.push(<span key={`t${pos}`}>{text.slice(pos, start)}</span>);
    parts.push(<mark key={`m${start}`} className={styles.mark}>{text.slice(start, end)}</mark>);
    pos = end;
  }
  if (pos < text.length) parts.push(<span key="tail">{text.slice(pos)}</span>);
  return <>{parts}</>;
}

/* ── Verse row (shared by both columns) ──────────────────────── */

function VerseRow({ v, textTerms }: { v: VerseSearchResult; textTerms: string[] }) {
  return (
    <li className={styles.refItem}>
      {v.verseNumber > 0 && <span className={styles.refVerseNum}>{v.verseNumber}</span>}
      <p className={styles.refContent}>
        <Highlight text={v.content} terms={textTerms} />
      </p>
    </li>
  );
}

/* ── Range block (sticky badge left + verses right) ─────────── */

function RangeBlock({ bookName, chapterNumber, range, textTerms, isRef }: {
  bookName: string;
  chapterNumber: number;
  range: VerseRange;
  textTerms: string[];
  isRef: boolean;
}) {
  const { open } = useBibleDrawer();
  const label = range.first === range.last
    ? `${bookName} ${chapterNumber}:${range.first}`
    : `${bookName} ${chapterNumber}:${range.first}–${range.last}`;

  return (
    <div className={styles.rangeBlock}>
      <button
        className={`${styles.rangeLabel} ${isRef ? styles.rangeLabelRef : styles.rangeLabelText}`}
        onClick={() => open({ book: bookName, chapter: chapterNumber, verse: range.first, verseTo: range.last !== range.first ? range.last : undefined })}
        title={`Ouvrir ${label}`}
      >
        {label}
      </button>
      <ul className={styles.refGroupList}>
        {range.verses.map(v => <VerseRow key={v.uuid} v={v} textTerms={textTerms} />)}
      </ul>
    </div>
  );
}

/* ── Group ref results by chapter → consecutive ranges ──────── */

interface VerseRange {
  rangeKey: string;
  first: number;
  last:  number;
  verses: VerseSearchResult[];
}
interface ChapterGroup {
  key:           string;
  bookName:      string;
  chapterNumber: number;
  summary:       string;
  ranges:        VerseRange[];
}

function groupByChapter(verses: VerseSearchResult[]): ChapterGroup[] {
  const map = new Map<string, ChapterGroup>();
  for (const v of verses) {
    const key = `${v.bookName}::${v.chapterNumber}`;
    if (!map.has(key))
      map.set(key, { key, bookName: v.bookName, chapterNumber: v.chapterNumber, summary: v.chapterSummary ?? '', ranges: [] });
    const ch = map.get(key)!;
    const last = ch.ranges[ch.ranges.length - 1];
    if (last && v.verseNumber === last.last + 1) {
      last.verses.push(v);
      last.last = v.verseNumber;
      last.rangeKey = `${last.first}-${last.last}`;
    } else {
      ch.ranges.push({ rangeKey: String(v.verseNumber), first: v.verseNumber, last: v.verseNumber, verses: [v] });
    }
  }
  return Array.from(map.values());
}

/* ── SearchPage ─────────────────────────────────────────────── */

export function SearchPage() {
  const [searchParams]  = useSearchParams();
  const q               = searchParams.get('q') ?? '';
  const { data: booksRes } = useApi<PaginatedResponse<BibleBookMeta>>('/api/bible/books?limit=100');
  const books = booksRes?.data ?? null;

  const parts = q.split(';').map(p => p.trim()).filter(Boolean);
  const textTerms: string[]    = [];
  const detectedRefs: BibleTarget[] = [];
  if (books) {
    for (const part of parts) {
      const ref = parseRef(part, books);
      if (ref) detectedRefs.push(ref);
      else if (part.length >= 2) textTerms.push(part);
    }
  }

  /* Text search with manual pagination */
  const [textResults, setTextResults] = useState<VerseSearchResult[]>([]);
  const [textTotal, setTextTotal] = useState(0);
  const [textOffset, setTextOffset] = useState(0);
  const [loadingText, setLoadingText] = useState(false);
  const PAGE_SIZE = 50;

  useEffect(() => {
    if (!books || textTerms.length === 0) { setTextResults([]); setTextTotal(0); return; }
    
    let cancelled = false;
    setLoadingText(true);
    setTextOffset(0);

    const textQuery = textTerms.join(';');
    const url = `/api/bible/search?q=${encodeURIComponent(textQuery)}&limit=${PAGE_SIZE}&offset=0`;
    
    fetch(url)
      .then(r => r.json())
      .then((res: PaginatedResponse<VerseSearchResult>) => {
        if (!cancelled) {
          setTextResults(res.data);
          setTextTotal(res.total);
          setLoadingText(false);
        }
      })
      .catch(() => { if (!cancelled) setLoadingText(false); });

    return () => { cancelled = true; };
  }, [q, books]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMoreText = () => {
    if (loadingText || textResults.length >= textTotal) return;
    const nextOffset = textOffset + PAGE_SIZE;
    setLoadingText(true);
    const textQuery = textTerms.join(';');
    const url = `/api/bible/search?q=${encodeURIComponent(textQuery)}&limit=${PAGE_SIZE}&offset=${nextOffset}`;
    
    fetch(url)
      .then(r => r.json())
      .then((res: PaginatedResponse<VerseSearchResult>) => {
        setTextResults(prev => [...prev, ...res.data]);
        setTextOffset(nextOffset);
        setLoadingText(false);
      })
      .catch(() => setLoadingText(false));
  };

  /* Reference resolution */
  const [refResults,  setRefResults]  = useState<VerseSearchResult[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  useEffect(() => {
    if (!books) return;
    const refs = parts.map(p => parseRef(p, books)).filter(Boolean) as BibleTarget[];
    if (refs.length === 0) { setRefResults([]); setLoadingRefs(false); return; }

    let cancelled = false;
    setLoadingRefs(true);

    const q = refs.map(r => {
      const v = r.verse != null ? `:${r.verse}${r.verseTo && r.verseTo !== r.verse ? `–${r.verseTo}` : ''}` : '';
      return `${r.book} ${r.chapter}${v}`;
    }).join(';');

    fetch(`/api/bible/search?q=${encodeURIComponent(q)}&limit=500`)
      .then(r => r.json())
      .then((res: PaginatedResponse<VerseSearchResult>) => {
        if (!cancelled) {
          setRefResults(res.data);
          setLoadingRefs(false);
        }
      })
      .catch(() => { if (!cancelled) setLoadingRefs(false); });

    return () => { cancelled = true; };
  }, [q, books]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.length < 2) {
    return <div className={styles.empty}><p>Entrez au moins 2 caractères pour rechercher.</p></div>;
  }

  const loading   = !books || loadingText || loadingRefs;
  const textCount = textTotal;
  const refCount  = refResults.length;

  return (
    <div className={styles.page}>
      <div className={styles.columns}>

        {/* ── Left: text results ── */}
        <div className={styles.colText}>
          <p className={styles.colTitle}>
            {loading && textResults.length === 0
              ? 'Recherche…'
              : `${textCount} verset${textCount !== 1 ? 's' : ''}`}
          </p>

          {loadingText && textResults.length === 0 && <div className={styles.loading}><span className={styles.spinner} /></div>}

          {!loadingText && textResults.length === 0 && textTerms.length > 0 && (
            <p className={styles.noResult}>Aucun résultat.</p>
          )}

          {textResults.length > 0 && (
            <div className={styles.refList}>
              {groupByChapter(textResults).map(({ key, bookName, chapterNumber, summary, ranges }) => (
                <div key={key} className={styles.refGroup}>
                  <h3 className={styles.refGroupTitle}>{bookName} {chapterNumber}</h3>
                  {summary && <p className={styles.chapterSummary}>{summary}</p>}
                  {ranges.map(range => (
                    <RangeBlock
                      key={range.rangeKey}
                      bookName={bookName}
                      chapterNumber={chapterNumber}
                      range={range}
                      textTerms={textTerms}
                      isRef={false}
                    />
                  ))}
                </div>
              ))}
              {textResults.length < textTotal && (
                <button
                  className={styles.loadMore}
                  onClick={loadMoreText}
                  disabled={loadingText}
                >
                  {loadingText ? 'Chargement…' : `Voir plus (${textTotal - textResults.length} restants)`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Right: reference results ── */}
        <div className={styles.colRef}>
          <p className={styles.colTitle}>
            {loadingRefs ? '…' : `${refCount} référence${refCount !== 1 ? 's' : ''}`}
          </p>

          {loadingRefs && <div className={styles.loading}><span className={styles.spinner} /></div>}

          {!loadingRefs && refResults.length === 0 && (
            <p className={styles.noResult}>Aucune référence détectée.</p>
          )}

          {!loadingRefs && refResults.length > 0 && (
            <div className={styles.refList}>
              {groupByChapter(refResults).map(({ key, bookName, chapterNumber, summary, ranges }) => (
                <div key={key} className={styles.refGroup}>
                  <h3 className={styles.refGroupTitle}>{bookName} {chapterNumber}</h3>
                  {summary && <p className={styles.chapterSummary}>{summary}</p>}
                  {ranges.map(range => (
                    <RangeBlock
                      key={range.rangeKey}
                      bookName={bookName}
                      chapterNumber={chapterNumber}
                      range={range}
                      textTerms={textTerms}
                      isRef={true}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
