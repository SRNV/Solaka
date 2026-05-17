import { useMemo } from 'react';
import type { BibleRelation } from '@/models/bible';
import type { LayoutResult } from '@/models/graph';
import type { PanelData } from './HoverPanel';

export function useCommentHighlights(
  panelData:        PanelData | null,
  searchHitUuids:   Map<string, string> | null,
  displayRelations: BibleRelation[] | null,
  layout:           LayoutResult | null,
) {
  const activeVerseUuids = useMemo<ReadonlySet<string> | null>(() => {
    const uuids = new Set<string>();
    if (panelData?.type === 'cube') uuids.add(panelData.uuid);
    if (searchHitUuids) for (const uuid of searchHitUuids.keys()) uuids.add(uuid);
    if (displayRelations) {
      for (const r of displayRelations) {
        for (const uuid of [r.from, r.toFrom, r.toTo].filter(Boolean)) uuids.add(uuid);
      }
    }
    return uuids.size > 0 ? uuids : null;
  }, [panelData, searchHitUuids, displayRelations]);

  const commentExtraXSet = useMemo<ReadonlySet<number> | null>(() => {
    if (!layout) return null;
    const xs = new Set<number>();
    if (searchHitUuids) {
      for (const uuid of searchHitUuids.keys()) {
        const pos = layout.uuidPosMap.get(uuid);
        if (pos) xs.add(pos.x);
      }
    }
    if (displayRelations) {
      for (const r of displayRelations) {
        for (const uuid of [r.from, r.toFrom, r.toTo].filter(Boolean)) {
          const pos = layout.uuidPosMap.get(uuid);
          if (pos) xs.add(pos.x);
        }
      }
    }
    return xs.size > 0 ? xs : null;
  }, [layout, searchHitUuids, displayRelations]);

  const commentHoverRange = useMemo<{ min: number; max: number } | null>(() => {
    if (!panelData || !layout) return null;
    if (panelData.type === 'cube') {
      const pos = layout.uuidPosMap.get(panelData.uuid);
      return pos ? { min: pos.x, max: pos.x } : null;
    }
    return null;
  }, [panelData, layout]);

  return { activeVerseUuids, commentExtraXSet, commentHoverRange };
}
