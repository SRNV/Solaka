import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BibleTarget } from '@/contexts/BibleDrawerContext.tsx';
import { useBibleDrawer } from '@/contexts/BibleDrawerContext.tsx';
import { useChapterData } from '@/hooks/useChapterData.ts';
import { useAllRelsByVerse } from '@/hooks/useAllRelsByVerse.ts';
import { bibleContentCache } from '@/store/bibleContent.store.ts';
import type { LeanVerse } from '@/types/bibleDrawer.ts';
import { buildGroupItems } from '@/utils/bibleDrawer.ts';
import { MapIconSvg } from './MapIconSvg.tsx';
import { VerseRow } from './VerseRow.tsx';
import { VerseGroup } from './VerseGroup.tsx';
import styles from './BibleDrawer.module.css';

interface MultiSectionProps {
  target: BibleTarget;
  onMap:  () => void;
}

export function MultiSection({ target, onMap }: MultiSectionProps) {
  const { uuids, summary, loading } = useChapterData(target.book, target.chapter);
  const { triggerShowInMap } = useBibleDrawer();
  const routerNavigate = useNavigate();

  const allVerses: LeanVerse[] = useMemo(() =>
    (uuids ?? []).map(id => bibleContentCache.getVerse(id)).filter((v): v is LeanVerse => !!v)
  , [uuids]);

  const verses = useMemo(() => {
    if (target.verse == null) return allVerses;
    return allVerses.filter(v => v.number >= target.verse! && v.number <= (target.verseTo ?? target.verse!));
  }, [allVerses, target.verse, target.verseTo]);

  const verseUuids     = useMemo(() => verses.map(v => v.uuid), [verses]);
  const relsByVerse    = useAllRelsByVerse(verseUuids);
  const verseListItems = useMemo(() => buildGroupItems(verses, relsByVerse), [verses, relsByVerse]);

  const handleShowInMap = useCallback((from: number, to?: number) => {
    triggerShowInMap([{ book: target.book, chapter: target.chapter, verse: from, ...(to && to !== from ? { verseTo: to } : {}) }]);
    routerNavigate('/graph');
  }, [triggerShowInMap, routerNavigate, target.book, target.chapter]);

  const refLabel = target.verse != null
    ? `${target.book} ${target.chapter}:${target.verse}${target.verseTo && target.verseTo !== target.verse ? `–${target.verseTo}` : ''}`
    : `${target.book} ${target.chapter}`;

  return (
    <section className={styles.multiSection}>
      <h3 className={styles.multiSectionHeader}>
        <span style={{ flex: 1 }}>{refLabel}</span>
        <button className={styles.mapBtnInline} title="Voir dans la Map" onClick={onMap}><MapIconSvg /></button>
      </h3>
      {summary && <p className={styles.summary}>{summary}</p>}
      {loading && <div className={styles.loading}>Chargement…</div>}
      {!loading && verseListItems.map((item, idx) =>
        item.type === 'solo' ? (
          <VerseRow key={item.verse.uuid} verse={item.verse} highlight={false} onShowInMap={handleShowInMap} />
        ) : (
          <VerseGroup
            key={`group_${idx}_${item.firstVerse.uuid}`}
            items={item.items}
            sharedRels={item.sharedRels}
            onShowInMap={handleShowInMap}
          />
        )
      )}
    </section>
  );
}
