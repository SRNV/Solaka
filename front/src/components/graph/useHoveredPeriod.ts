import { useMemo } from 'react';
import type { BibleBookOrder } from '@/models/bible';
import type { LayoutResult }   from '@/utils/graphLayout';
import { useGraphModeStore }   from '@/store/graphMode.store';

/** Returns the world-X range of the date-group containing the hovered book (historical mode only). */
export function useHoveredPeriod(
  effectiveHoveredBook: string | null,
  layout:               LayoutResult | null,
  bookOrderData:        BibleBookOrder[] | null,
): { startX: number; endX: number } | null {
  const { sortMode, histSubMode } = useGraphModeStore();

  return useMemo(() => {
    if (!effectiveHoveredBook || sortMode !== 'historical' || !bookOrderData || !layout?.bookLabels.length) return null;
    const dateMap = new Map(bookOrderData.map(b => [b.number, b[histSubMode]]));
    let segment: { startX: number; endX: number } | null = null;
    let currentLabel: string | null = null;
    let currentStartX = 0, currentEndX = 0;
    let containsHovered = false;
    for (const b of layout.bookLabels) {
      const dateRange = dateMap.get(b.number);
      const label     = dateRange ? String(dateRange[0]) : null;
      if (label !== currentLabel) {
        if (containsHovered) { segment = { startX: currentStartX, endX: currentEndX }; break; }
        currentLabel    = label;
        currentStartX   = b.startX;
        currentEndX     = b.endX;
        containsHovered = b.name === effectiveHoveredBook;
      } else {
        currentEndX = b.endX;
        if (b.name === effectiveHoveredBook) containsHovered = true;
      }
    }
    if (containsHovered && !segment) segment = { startX: currentStartX, endX: currentEndX };
    return segment;
  }, [effectiveHoveredBook, sortMode, bookOrderData, histSubMode, layout?.bookLabels]);
}
