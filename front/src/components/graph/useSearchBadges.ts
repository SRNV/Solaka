import { useMemo } from 'react';
import { V_STEP } from '@/utils/graphConstants';
import type { BibleRelation } from '@/models/bible';
import type { LayoutResult } from '@/models/graph';

export interface SearchBadge {
  uuid:        string;
  book:        string;
  chapter:     number;
  verseStart:  number;
  verseEnd:    number;
  x:           number;
  y:           number;
  isAuthority: boolean;
  label:       string;
}

export function useSearchBadges(
  searchHitUuids:  Map<string, string> | null,
  layout:          LayoutResult | null,
  stompRelations:  BibleRelation[],
  drawerRelations: BibleRelation[] | null,
): SearchBadge[] {
  const authorityUuids = useMemo(() => {
    const uuids = new Set<string>();
    for (const r of [...(stompRelations ?? []), ...(drawerRelations ?? [])]) {
      if ((r.relType ?? (r as any).relation_type) === 'authority') {
        uuids.add(r.from); uuids.add(r.toFrom); uuids.add(r.toTo);
      }
    }
    return uuids;
  }, [stompRelations, drawerRelations]);

  return useMemo(() => {
    if (!searchHitUuids || !layout) return [];
    const badges: SearchBadge[] = [];
    const hitsByX = new Map<number, string[]>();
    for (const uuid of searchHitUuids.keys()) {
      const pos = layout.uuidPosMap.get(uuid);
      if (pos) { if (!hitsByX.has(pos.x)) hitsByX.set(pos.x, []); hitsByX.get(pos.x)!.push(uuid); }
    }
    for (const [x, uuids] of hitsByX) {
      uuids.sort((a, b) => (layout.uuidPosMap.get(a)?.y ?? 0) - (layout.uuidPosMap.get(b)?.y ?? 0));
      let rangeStart = 0;
      for (let i = 1; i <= uuids.length; i++) {
        const prevPos = layout.uuidPosMap.get(uuids[i - 1]);
        const currPos = i < uuids.length ? layout.uuidPosMap.get(uuids[i]) : null;
        if (!currPos || Math.abs(currPos.y - prevPos!.y - V_STEP) > 0.001) {
          const range    = uuids.slice(rangeStart, i);
          const topPos   = layout.uuidPosMap.get(range[range.length - 1])!;
          const refStart = layout.uuidRefMap.get(range[0])!;
          const refEnd   = layout.uuidRefMap.get(range[range.length - 1])!;
          badges.push({
            uuid:        range[0],
            book:        refStart.book,
            chapter:     refStart.chapter,
            verseStart:  refStart.verse!,
            verseEnd:    refEnd.verse!,
            x,
            y:           topPos.y + V_STEP,
            isAuthority: range.some(u => authorityUuids.has(u)),
            label:       range.length > 1
              ? `${refStart.book.slice(0, 3)}. ${refStart.chapter}:${refStart.verse}–${refEnd.verse}`
              : `${refStart.book.slice(0, 3)}. ${refStart.chapter}:${refStart.verse}`,
          });
          rangeStart = i;
        }
      }
    }
    return badges;
  }, [searchHitUuids, layout, authorityUuids]);
}
