import { useEffect, useRef, type MutableRefObject } from 'react';
import { useActiveRelationsStore } from '@/store/activeRelations.store';
import { useTraditionStore }       from '@/store/tradition.store';
import { useBibleDrawer }          from '@/contexts/BibleDrawerContext';
import { ArcMesh }                 from './ArcMesh';
import type { BibleRelation }      from '@/models/bible';
import type { LayoutResult }       from '@/utils/graphLayout';

interface Props {
  layout:        LayoutResult;
  minPeakY:      number;
  onArcHover:    (xs: Set<number> | null) => void;
  onArcHoverRel: (rel: BibleRelation | null) => void;
}

/** R3F component: owns arc animation refs and renders ArcMesh. Reads display state from stores. */
export function RelationsCanvas({ layout, minPeakY, onArcHover, onArcHoverRel }: Props) {
  const displayRelations = useActiveRelationsStore(s => s.displayRelations);
  const { showCath, showProt, showPulse } = useTraditionStore();
  const { openMany } = useBibleDrawer();

  const arcFromMapRef    = useRef<Map<string, { x: number; y: number; z: number }> | null>(null) as MutableRefObject<Map<string, { x: number; y: number; z: number }> | null>;
  const arcAnimStartRef  = useRef<number>(-1);
  const prevLayoutRef    = useRef<LayoutResult | null>(null);

  useEffect(() => {
    const prev = prevLayoutRef.current;
    prevLayoutRef.current = layout;
    if (prev && prev !== layout) {
      arcFromMapRef.current   = prev.uuidPosMap;
      arcAnimStartRef.current = performance.now();
    }
  }, [layout]);

  if (!displayRelations) return null;

  return (
    <ArcMesh
      relations={displayRelations}
      uuidPosMap={layout.uuidPosMap}
      uuidRefMap={layout.uuidRefMap}
      minPeakY={minPeakY}
      showCath={showCath}
      showProt={showProt}
      animate={showPulse}
      fromMapRef={arcFromMapRef}
      arcAnimStartRef={arcAnimStartRef}
      onRelClick={openMany}
      onArcHover={onArcHover}
      onArcHoverRel={onArcHoverRel}
    />
  );
}
