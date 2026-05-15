import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BibleTarget } from '@/contexts/BibleDrawerContext.tsx';
import { useBibleDrawer } from '@/contexts/BibleDrawerContext.tsx';
import { useApi } from '@/hooks/useApi.ts';
import { useChapterData } from '@/hooks/useChapterData.ts';
import { useAllRelsByVerse } from '@/hooks/useAllRelsByVerse.ts';
import { usePatristicCommentSummaries } from '@/hooks/useCommentSummaries.ts';
import { bibleContentCache } from '@/store/bibleContent.store.ts';
import type { BibleBookMeta, PaginatedResponse } from '@/types/bible.ts';
import type { LeanVerse } from '@/types/bibleDrawer.ts';
import { buildGroupItems } from '@/utils/bibleDrawer.ts';
import { MapIconSvg } from './MapIconSvg.tsx';
import { VerseRow } from './VerseRow.tsx';
import { VerseGroup } from './VerseGroup.tsx';
import styles from './BibleDrawer.module.css';
import cs from './BibleDrawerContent.module.css';

interface BibleDrawerContentProps {
  target: BibleTarget;
  close:  () => void;
  open:   (t: BibleTarget) => void;
  onMap:  () => void;
}

export function BibleDrawerContent({ target, close, open, onMap }: BibleDrawerContentProps) {
  const [focused, setFocused] = useState(true);

  const { uuids, summary, loading, notFound } = useChapterData(target.book, target.chapter);
  usePatristicCommentSummaries(uuids ?? null);
  const { data: booksRes } = useApi<PaginatedResponse<BibleBookMeta>>('/api/bible/books?limit=100');
  const { triggerShowInMap } = useBibleDrawer();
  const routerNavigate = useNavigate();

  const allBooks: BibleBookMeta[] = useMemo(() => {
    if (!booksRes) return [];
    const d = booksRes.data;
    if (Array.isArray(d)) return d;
    if (d && typeof d === 'object' && Array.isArray((d as any).data)) return (d as any).data;
    return [];
  }, [booksRes]);

  const allVerses: LeanVerse[] = useMemo(() =>
    (uuids ?? []).map(id => bibleContentCache.getVerse(id)).filter((v): v is LeanVerse => !!v)
  , [uuids]);

  // If focused filter yields no results (verse gap in data), fall back to full chapter
  const displayVerses = useMemo(() => {
    if (!focused || target.verse == null) return allVerses;
    const filtered = allVerses.filter(v => v.number >= target.verse! && v.number <= (target.verseTo ?? target.verse!));
    return filtered.length > 0 ? filtered : allVerses;
  }, [allVerses, focused, target.verse, target.verseTo]);

  const allDisplayedUuids = useMemo(() => displayVerses.map(v => v.uuid), [displayVerses]);
  const relsByVerse       = useAllRelsByVerse(allDisplayedUuids);
  const verseListItems    = useMemo(
    () => buildGroupItems(displayVerses, relsByVerse),
    [displayVerses, relsByVerse],
  );

  const handleShowInMap = useCallback((from: number, to?: number) => {
    triggerShowInMap([{ book: target.book, chapter: target.chapter, verse: from, ...(to && to !== from ? { verseTo: to } : {}) }]);
    routerNavigate('/graph');
  }, [triggerShowInMap, routerNavigate, target.book, target.chapter]);

  useEffect(() => { setFocused(true); }, [target.book, target.chapter, target.verse, target.verseTo]);

  function navigate(delta: -1 | 1) {
    if (!allBooks.length) return;
    const bookMeta = allBooks.find(b => b.name === target.book);
    if (!bookMeta) return;

    // Use actual chapter numbers if available (handles books with gaps like Siracide)
    const chNums = bookMeta.chapterNumbers ?? Array.from({ length: bookMeta.chapterCount }, (_, i) => i + 1);
    const curIdx = chNums.indexOf(target.chapter);
    const nextIdx = curIdx + delta;

    if (nextIdx >= 0 && nextIdx < chNums.length) {
      open({ book: target.book, chapter: chNums[nextIdx] });
      return;
    }

    // Cross book boundary
    if (delta === -1) {
      const prev = allBooks.find(b => b.number === bookMeta.number - 1);
      if (!prev) return;
      const prevNums = prev.chapterNumbers ?? Array.from({ length: prev.chapterCount }, (_, i) => i + 1);
      open({ book: prev.name, chapter: prevNums[prevNums.length - 1] });
    } else {
      const next = allBooks.find(b => b.number === bookMeta.number + 1);
      if (!next) return;
      const nextNums = next.chapterNumbers ?? Array.from({ length: next.chapterCount }, (_, i) => i + 1);
      open({ book: next.name, chapter: nextNums[0] });
    }
  }

  const bookMeta = allBooks.find(b => b.name === target.book);
  const chNums   = bookMeta?.chapterNumbers ?? (bookMeta ? Array.from({ length: bookMeta.chapterCount }, (_, i) => i + 1) : []);
  const curIdx   = chNums.indexOf(target.chapter);
  const hasPrev  = !!bookMeta && (curIdx > 0 || bookMeta.number > 1);
  const hasNext  = !!bookMeta && (curIdx < chNums.length - 1 || allBooks.some(b => b.number === bookMeta.number + 1));

  return (
    <>
      <div className={styles.backdrop} onClick={close} />
      <aside className={styles.drawer}>
        <div className={styles.header}>
          <button className={styles.closeBtn} onClick={close} title="Fermer">✕</button>
          <button className={styles.navBtn} onClick={() => navigate(-1)} disabled={!hasPrev} title="Précédent">‹</button>
          <span className={styles.heading}>{target.book} {target.chapter}</span>
          <button className={styles.navBtn} onClick={() => navigate(1)} disabled={!hasNext} title="Suivant">›</button>
          <button className={styles.mapBtnInline} title="Voir dans la Map" onClick={onMap}><MapIconSvg /></button>
        </div>

        {summary && <p className={cs.summary}>{summary}</p>}

        {target.verse != null && !notFound && (
          <button className={cs.focusToggle} onClick={() => setFocused(f => !f)}>
            {focused ? 'Voir le chapitre complet' : 'Réduire au verset'}
          </button>
        )}

        {loading   && <div className={cs.loading}>Chargement…</div>}
        {notFound  && <div className={cs.loading}>Chapitre non disponible.</div>}

        {!loading && !notFound && (
          <div className={styles.list}>
            {verseListItems.map((item, idx) =>
              item.type === 'solo' ? (
                <VerseRow
                  key={item.verse.uuid}
                  verse={item.verse}
                  highlight={item.verse.number === target.verse}
                  onShowInMap={handleShowInMap}
                  bookName={target.book}
                  chapterNum={target.chapter}
                  chapterVerses={allVerses}
                />
              ) : (
                <VerseGroup
                  key={`group_${idx}_${item.firstVerse.uuid}`}
                  items={item.items}
                  sharedRels={item.sharedRels}
                  highlightVerseNum={target.verse}
                  onShowInMap={handleShowInMap}
                  bookName={target.book}
                  chapterNum={target.chapter}
                  chapterVerses={allVerses}
                />
              )
            )}
          </div>
        )}
      </aside>
    </>
  );
}
