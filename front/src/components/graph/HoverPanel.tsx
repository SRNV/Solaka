import type { BibleRelation, BibleBookMeta } from '@/models/bible';
import type { LayoutResult } from '@/utils/graphLayout.ts';
import styles from './HoverPanel.module.css';

export type PanelData =
  | { type: 'arc';  rel: BibleRelation; verses: { from: string; fromSummary: string; to: string; toSummary: string } | null }
  | { type: 'cube'; uuid: string; verse: string | null; summary: string | null; verseEnd?: number }
  | { type: 'book'; book: BibleBookMeta };

const REL_LABEL: Record<string, string> = {
  authority:   'Autorité',
  citation:    'Citation',
  fulfillment: 'Accomplissement',
  typology:    'Typologie',
  allusion:    'Allusion',
  parallel:    'Parallèle',
  thematic:    'Thématique',
};

function fmtTarget(book: string, chapter: number, verse: number, verseTo?: number): string {
  const range = verseTo && verseTo !== verse ? `–${verseTo}` : '';
  return `${book} ${chapter}:${verse}${range}`;
}

interface HoverPanelProps {
  panelData: PanelData;
  layout:    LayoutResult;
}

export function HoverPanel({ panelData, layout }: HoverPanelProps) {
  return (
    <div className={styles.hoverPanel}>
      {panelData.type === 'book' && (
        <>
          <h1 className={styles.hoverRef}>{panelData.book.name}</h1>
          {panelData.book.author && <p className={styles.hoverContext}>{panelData.book.author}</p>}
        </>
      )}

      {panelData.type === 'arc' && (() => {
        const fromRef   = layout.uuidRefMap.get(panelData.rel.from);
        const fromToRef = panelData.rel.fromTo ? layout.uuidRefMap.get(panelData.rel.fromTo) : null;
        const toFromRef = layout.uuidRefMap.get(panelData.rel.toFrom);
        const toToRef   = layout.uuidRefMap.get(panelData.rel.toTo);
        const fromStr   = fromRef ? fmtTarget(fromRef.book, fromRef.chapter, fromRef.verse, fromToRef?.verse) : '?';
        const toStr     = toFromRef ? fmtTarget(toFromRef.book, toFromRef.chapter, toFromRef.verse, toToRef?.verse) : '?';
        return (
          <>
            <h1 className={styles.hoverRef}>{fromStr} → {toStr}</h1>
            <p className={styles.hoverContext}>{REL_LABEL[panelData.rel.relType ?? ''] ?? panelData.rel.relType}</p>
          </>
        );
      })()}

      {panelData.type === 'cube' && (() => {
        const ref = layout.uuidRefMap.get(panelData.uuid);
        if (!ref) return null;
        return (
          <>
            <h1 className={styles.hoverRef}>{fmtTarget(ref.book, ref.chapter, ref.verse, panelData.verseEnd)}</h1>
            <p className={styles.hoverContext}>{ref.book}</p>
          </>
        );
      })()}
    </div>
  );
}
