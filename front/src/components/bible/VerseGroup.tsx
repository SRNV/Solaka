import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBibleDrawer } from '@/contexts/BibleDrawerContext.tsx';
import type { RelRow } from '@/store/relations.store.ts';
import type { ChildResult, LeanVerse, VerseListItem } from '@/models/bibleDrawer';
import { EMPTY_SET, badgeLabel, collectVerses, fetchVersesByRel } from '@/utils/bibleDrawer.ts';
import { usePatristicCommentStore } from '@/store/comment.store.ts';
import { useCommentModalStore } from '@/store/commentModal.store.ts';
import type { CommentSummary, PatristicPersonSnippet } from '@/models/patristic';
import { MapIconSvg } from './MapIconSvg.tsx';
import { VerseRow } from './VerseRow.tsx';
import { VerseCommentBar } from './VerseCommentBar.tsx';
import styles from './VerseGroup.module.css';

interface VerseGroupProps {
  items:                 VerseListItem[];
  sharedRels:            RelRow[];
  highlightVerseNum?:    number;
  ancestors?:            ReadonlySet<string>;
  suppressedFromParent?: ReadonlySet<string>;
  onShowInMap?:          (from: number, to?: number) => void;
  bookName?:             string;
  chapterNum?:           number;
  chapterVerses?:        LeanVerse[];
}

export function VerseGroup({ items, sharedRels, highlightVerseNum, ancestors = EMPTY_SET, suppressedFromParent = EMPTY_SET, onShowInMap, bookName, chapterNum, chapterVerses }: VerseGroupProps) {
  const { open: openDrawer, triggerShowInMap } = useBibleDrawer();
  const routerNavigate   = useNavigate();
  const openCommentModal = useCommentModalStore(s => s.open);

  const [activeRelKey, setActiveRelKey] = useState<string | null>(null);
  const [childResults, setChildResults] = useState<ChildResult[]>([]);
  const [childLoading, setChildLoading] = useState(false);

  const suppressedRelTargets = useMemo(
    () => new Set([...suppressedFromParent, ...sharedRels.map(r => r.toFrom)]),
    [sharedRels, suppressedFromParent],
  );

  const summaries  = usePatristicCommentStore(s => s.summaries);
  const allVerses  = useMemo(() => collectVerses(items), [items]);

  const groupSummary = useMemo<CommentSummary | null>(() => {
    let count = 0;
    const personMap = new Map<string, PatristicPersonSnippet>();
    for (const v of allVerses) {
      const s = summaries.get(v.uuid);
      if (!s) continue;
      count += s.count;
      for (const a of s.persons) {
        if (!personMap.has(a.slug)) personMap.set(a.slug, a);
      }
    }
    if (count === 0) return null;
    return { count, persons: [...personMap.values()].slice(0, 3) };
  }, [allVerses, summaries]);

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
            className={styles.groupedVerse}
            bookName={bookName}
            chapterNum={chapterNum}
            chapterVerses={chapterVerses}
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
            bookName={bookName}
            chapterNum={chapterNum}
            chapterVerses={chapterVerses}
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

        {groupSummary && chapterVerses && bookName && chapterNum && (
          <VerseCommentBar
            summary={groupSummary}
            onClick={() => {
              const firstWithComment = chapterVerses.find(v => summaries.get(v.uuid)?.count);
              if (!firstWithComment) return;
              openCommentModal({
                verseIdx:   chapterVerses.findIndex(v => v.uuid === firstWithComment.uuid),
                verses:     chapterVerses,
                bookName,
                chapterNum,
              });
            }}
          />
        )}
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
