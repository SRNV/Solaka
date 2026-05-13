import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBibleDrawer } from '@/contexts/BibleDrawerContext.tsx';
import type { RelRow } from '@/store/relations.store.ts';
import type { ChildResult, VerseListItem } from '@/types/bibleDrawer.ts';
import { EMPTY_SET, badgeLabel, collectVerses, fetchVersesByRel } from '@/utils/bibleDrawer.ts';
import { MapIconSvg } from './MapIconSvg.tsx';
import { VerseRow } from './VerseRow.tsx';
import styles from './BibleDrawer.module.css';

interface VerseGroupProps {
  items:                 VerseListItem[];
  sharedRels:            RelRow[];
  highlightVerseNum?:    number;
  ancestors?:            ReadonlySet<string>;
  suppressedFromParent?: ReadonlySet<string>;
  onShowInMap?:          (from: number, to?: number) => void;
}

export function VerseGroup({ items, sharedRels, highlightVerseNum, ancestors = EMPTY_SET, suppressedFromParent = EMPTY_SET, onShowInMap }: VerseGroupProps) {
  const { open: openDrawer, triggerShowInMap } = useBibleDrawer();
  const routerNavigate = useNavigate();

  const [activeRelKey, setActiveRelKey] = useState<string | null>(null);
  const [childResults, setChildResults] = useState<ChildResult[]>([]);
  const [childLoading, setChildLoading] = useState(false);

  const suppressedRelTargets = useMemo(
    () => new Set([...suppressedFromParent, ...sharedRels.map(r => r.toFrom)]),
    [sharedRels, suppressedFromParent],
  );

  const allVerses = useMemo(() => collectVerses(items), [items]);

  const groupAncestors = useMemo(() => {
    const chain = new Set([...ancestors]);
    for (const v of allVerses) chain.add(v.uuid);
    return chain;
  }, [ancestors, allVerses]);

  async function handleGroupBadgeClick(r: RelRow) {
    if (!r.toFromRef) return;
    if (r.toFromRef.verseNumber === 0) {
      openDrawer({ book: r.toFromRef.bookName, chapter: r.toFromRef.chapterNumber });
      return;
    }
    if (r.toFrom === activeRelKey) { setActiveRelKey(null); setChildResults([]); return; }
    setActiveRelKey(r.toFrom); setChildResults([]); setChildLoading(true);
    try   { setChildResults(await fetchVersesByRel(r)); }
    catch { setActiveRelKey(null); }
    finally { setChildLoading(false); }
  }

  function handleChildShowInMap(cr: ChildResult, from: number, to?: number) {
    triggerShowInMap([{
      book: cr.bookName, chapter: cr.chapterNumber, verse: from,
      ...(to && to !== from ? { verseTo: to } : {}),
    }]);
    routerNavigate('/graph');
  }

  const hasAuthority = sharedRels.some(r => r.relType === 'authority');
  const hasCath      = sharedRels.some(r => r.trad === 'c' && r.relType !== 'authority');
  const groupClass   = [
    styles.verseGroup,
    hasAuthority ? styles.verseGroupAuthority :
    hasCath      ? ''                          : styles.verseGroupProtestant,
  ].filter(Boolean).join(' ');

  return (
    <div className={groupClass}>
      {items.map((item, idx) =>
        item.type === 'solo' ? (
          <VerseRow
            key={item.verse.uuid}
            verse={item.verse}
            highlight={item.verse.number === highlightVerseNum}
            ancestors={ancestors}
            suppressedRelTargets={suppressedRelTargets}
            onShowInMap={onShowInMap}
          />
        ) : (
          <VerseGroup
            key={`sub_${idx}_${item.firstVerse.uuid}`}
            items={item.items}
            sharedRels={item.sharedRels}
            highlightVerseNum={highlightVerseNum}
            ancestors={ancestors}
            suppressedFromParent={suppressedRelTargets}
            onShowInMap={onShowInMap}
          />
        )
      )}

      <div className={styles.groupBlock}>
        <div className={styles.groupRangeRow}>
          <span className={styles.groupRange}>
            vv. {allVerses[0].number}–{allVerses[allVerses.length - 1].number}
          </span>
          {onShowInMap && (
            <button
              className={styles.mapBtnInline}
              title="Voir dans la Map"
              onClick={() => onShowInMap(allVerses[0].number, allVerses[allVerses.length - 1].number)}
            >
              <MapIconSvg />
            </button>
          )}
        </div>
        <div className={styles.groupRelations}>
          {sharedRels.map((r, i) => (
            <button
              key={i}
              className={[
                styles.groupBadge,
                r.trad === 'c' ? styles.groupBadgeCatholic : styles.groupBadgeProtestant,
                r.relType === 'authority' ? styles.groupBadgeAuthority : '',
                r.toFrom === activeRelKey ? styles.groupBadgeActive : '',
              ].filter(Boolean).join(' ')}
              onClick={() => handleGroupBadgeClick(r)}
              title={`${r.relType} · ${r.sourceUrl ?? ''}`}
            >
              {badgeLabel(r)}
            </button>
          ))}
        </div>
      </div>

      {childLoading && <p className={styles.childLoading}>Chargement…</p>}
      {!childLoading && childResults.length > 0 && activeRelKey && (
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
              ancestors={groupAncestors}
              onShowInMap={(from, to) => handleChildShowInMap(cr, from, to)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
