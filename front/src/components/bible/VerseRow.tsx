import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBibleDrawer } from '@/contexts/BibleDrawerContext.tsx';
import { useVerseRelations } from '@/hooks/useVerseRelations.ts';
import type { RelRow } from '@/store/relations.store.ts';
import type { ChildResult, LeanVerse } from '@/types/bibleDrawer.ts';
import { EMPTY_SET, fetchVersesByRel, sortRels } from '@/utils/bibleDrawer.ts';
import { MapIconSvg } from './MapIconSvg.tsx';
import { RelationBadgeList } from './RelationBadgeList.tsx';
import styles from './BibleDrawer.module.css';

interface VerseRowProps {
  verse:                 LeanVerse;
  highlight:             boolean;
  ancestors?:            ReadonlySet<string>;
  suppressedRelTargets?: ReadonlySet<string>;
  onShowInMap?:          (from: number, to?: number) => void;
}

export function VerseRow({ verse, highlight, ancestors = EMPTY_SET, suppressedRelTargets, onShowInMap }: VerseRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { open: openDrawer, triggerShowInMap } = useBibleDrawer();
  const routerNavigate = useNavigate();

  const rawRels = useVerseRelations(verse.uuid);
  const rels    = useMemo(
    () => sortRels(rawRels.filter(r =>
      !ancestors.has(r.toFrom) && !(suppressedRelTargets?.has(r.toFrom)),
    )),
    [rawRels, ancestors, suppressedRelTargets],
  );

  const [activeKey,    setActiveKey]    = useState<string | null>(null);
  const [childResults, setChildResults] = useState<ChildResult[]>([]);
  const [childLoading, setChildLoading] = useState(false);

  useEffect(() => {
    if (highlight && ref.current)
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlight]);

  async function handleRelClick(r: RelRow) {
    if (!r.toFromRef) return;
    if (r.toFromRef.verseNumber === 0) {
      openDrawer({ book: r.toFromRef.bookName, chapter: r.toFromRef.chapterNumber });
      return;
    }
    if (r.toFrom === activeKey) { setActiveKey(null); setChildResults([]); return; }
    setActiveKey(r.toFrom); setChildResults([]); setChildLoading(true);
    try   { setChildResults(await fetchVersesByRel(r)); }
    catch { setActiveKey(null); }
    finally { setChildLoading(false); }
  }

  const handleChildShowInMap = useCallback((cr: ChildResult, from: number, to?: number) => {
    triggerShowInMap([{
      book: cr.bookName, chapter: cr.chapterNumber, verse: from,
      ...(to && to !== from ? { verseTo: to } : {}),
    }]);
    routerNavigate('/graph');
  }, [triggerShowInMap, routerNavigate]);

  return (
    <div ref={ref} className={`${styles.verse} ${highlight ? styles.highlight : ''}`}>
      <div className={styles.verseHeader}>
        <span className={styles.verseNum}>{verse.number}</span>
        <span className={styles.verseText}>{verse.content}</span>
        {onShowInMap && (
          <button className={styles.mapBtnInline} title="Voir dans la Map" onClick={() => onShowInMap(verse.number)}>
            <MapIconSvg />
          </button>
        )}
      </div>

      {rels.length > 0 && (
        <div className={styles.relations}>
          <RelationBadgeList
            rels={rels}
            activeKey={activeKey}
            onRelClick={handleRelClick}
            badgeClass={r => `${styles.badge} ${r.trad === 'c' ? styles.badgeCatholic : styles.badgeProtestant}`}
            activeClass={styles.badgeActive}
            authorityClass={styles.badgeAuthority}
          />
        </div>
      )}

      {childLoading && <p className={styles.childLoading}>Chargement…</p>}
      {!childLoading && childResults.length > 0 && activeKey && (() => {
        const chain = new Set([...ancestors, verse.uuid]);
        return (
          <div className={styles.childSection}>
            <div className={styles.childHeader}>
              <p className={styles.childLabel}>
                {childResults[0].bookName} {childResults[0].chapterNumber}:{childResults[0].verse.number}
                {childResults.length > 1 ? `–${childResults[childResults.length - 1].verse.number}` : ''}
              </p>
            </div>
            {childResults.map(cr => (
              <VerseRow
                key={cr.verse.uuid}
                verse={cr.verse}
                highlight={false}
                ancestors={chain}
                onShowInMap={(from, to) => handleChildShowInMap(cr, from, to)}
              />
            ))}
          </div>
        );
      })()}
    </div>
  );
}
