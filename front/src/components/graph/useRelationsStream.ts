import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeRelations, mergeRelationIncremental } from '@/utils/graphRelations';
import type { BibleRelation } from '@/models/bible';
import type { LayoutResult } from '@/models/graph';

export function useRelationsStream(
  stompRelations:  BibleRelation[],
  drawerRelations: BibleRelation[] | null,
  layout:          LayoutResult | null,
): BibleRelation[] | null {
  const [mergedStompRels, setMergedStompRels] = useState<BibleRelation[]>([]);
  const prevStompLenRef = useRef(0);
  const prevMergedRef   = useRef<BibleRelation[]>([]);
  const prevLayoutRef   = useRef<LayoutResult | null>(null);

  useEffect(() => {
    const cur           = stompRelations ?? [];
    const posMap        = layout?.uuidPosMap;
    const layoutChanged = layout !== prevLayoutRef.current;
    prevLayoutRef.current = layout;

    if (cur.length === 0 || !posMap) {
      prevStompLenRef.current = 0;
      prevMergedRef.current   = [];
      setMergedStompRels([]);
      return;
    }

    if (layoutChanged || cur.length < prevStompLenRef.current) {
      const fresh = normalizeRelations(cur, posMap);
      prevStompLenRef.current = cur.length;
      prevMergedRef.current   = fresh;
      setMergedStompRels(fresh);
      return;
    }

    let current = prevMergedRef.current;
    for (let i = prevStompLenRef.current; i < cur.length; i++) {
      current = mergeRelationIncremental(current, cur[i], posMap);
    }
    prevStompLenRef.current = cur.length;
    prevMergedRef.current   = current;
    setMergedStompRels(current);
  }, [stompRelations, layout]);

  return useMemo(() => {
    if (!layout) return null;
    const activeStompRels = stompRelations.length > 0 ? mergedStompRels : [];
    const combined = [...(drawerRelations ?? []), ...activeStompRels];
    if (combined.length === 0) return null;
    if (!drawerRelations?.length) return activeStompRels.length > 0 ? activeStompRels : null;
    return normalizeRelations(combined, layout.uuidPosMap);
  }, [drawerRelations, mergedStompRels, stompRelations, layout]);
}
