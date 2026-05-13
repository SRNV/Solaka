import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BibleTarget } from '@/contexts/BibleDrawerContext.tsx';
import { useBibleDrawer } from '@/contexts/BibleDrawerContext.tsx';
import { useApi } from '@/hooks/useApi.ts';
import { useChapterData } from '@/hooks/useChapterData.ts';
import { useAllRelsByVerse } from '@/hooks/useAllRelsByVerse.ts';
import { bibleContentCache } from '@/store/bibleContent.store.ts';
import type { BibleBookMeta, PaginatedResponse } from '@/types/bible.ts';
import type { LeanVerse } from '@/types/bibleDrawer.ts';
import { buildGroupItems } from '@/utils/bibleDrawer.ts';
import { MapIconSvg } from './MapIconSvg.tsx';
import { VerseRow } from './VerseRow.tsx';
import { VerseGroup } from './VerseGroup.tsx';
import styles from './BibleDrawer.module.css';

interface BibleDrawerContentProps {
  target: BibleTarget;
  close:  () => void;
  open:   (t: BibleTarget) => void;
  onMap:  () => void;
}

export function BibleDrawerContent({ target, close, open, onMap }: BibleDrawerContentProps) {
  const [focused, setFocused] = useState(true);

  const { uuids, summary, loading } = useChapterData(target.book, target.chapter);
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

  const displayVerses = useMemo(() => {
    if (!focused || target.verse == null) return allVerses;
    return allVerses.filter(v => v.number >= target.verse! && v.number <= (target.verseTo ?? target.verse!));
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
    let ch   = target.chapter + delta;
    let book = target.book;
    if (ch < 1) {
      const prev = allBooks.find(b => b.number === bookMeta.number - 1);
      if (!prev) return;
      book = prev.name; ch = prev.chapterCount;
    } else if (ch > bookMeta.chapterCount) {
      const next = allBooks.find(b => b.number === bookMeta.number + 1);
      if (!next) return;
      book = next.name; ch = 1;
    }
    open({ book, chapter: ch });
  }

  const bookMeta = allBooks.find(b => b.name === target.book);
  const hasPrev  = !!bookMeta && (target.chapter > 1 || bookMeta.number > 1);
  const hasNext  = !!bookMeta && (
    target.chapter < bookMeta.chapterCount ||
    allBooks.some(b => b.number === bookMeta.number + 1)
  );

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

        {summary && <p className={styles.summary}>{summary}</p>}

        {target.verse != null && (
          <button className={styles.focusToggle} onClick={() => setFocused(f => !f)}>
            {focused ? 'Voir le chapitre complet' : 'Réduire au verset'}
          </button>
        )}

        {loading && <div className={styles.loading}>Chargement…</div>}

        {!loading && (
          <div className={styles.list}>
            {verseListItems.map((item, idx) =>
              item.type === 'solo' ? (
                <VerseRow
                  key={item.verse.uuid}
                  verse={item.verse}
                  highlight={item.verse.number === target.verse}
                  onShowInMap={handleShowInMap}
                />
              ) : (
                <VerseGroup
                  key={`group_${idx}_${item.firstVerse.uuid}`}
                  items={item.items}
                  sharedRels={item.sharedRels}
                  highlightVerseNum={target.verse}
                  onShowInMap={handleShowInMap}
                />
              )
            )}
          </div>
        )}
      </aside>
    </>
  );
}
