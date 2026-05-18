import { useEffect, useMemo } from 'react';
import type { BibleBookOrder } from '@/models/bible';
import type { LayoutResult }   from '@/utils/graphLayout';
import { useGraphModeStore }   from '@/store/graphMode.store';
import { useYearMarkersStore } from '@/store/yearMarkers.store';
import { buildYearPoints, yearToWorldX } from './friseUtils';

/** Computes yearPoints from bookOrderData + layout and syncs them into yearMarkers.store. */
export function useYearMarkers(layout: LayoutResult | null, bookOrderData: BibleBookOrder[] | null) {
  const { sortMode, histSubMode }              = useGraphModeStore();
  const { setYearPoints, setYear0WorldX }      = useYearMarkersStore();

  const yearPoints = useMemo(() => {
    if (sortMode !== 'historical' || !bookOrderData || !layout?.bookLabels.length) return [];
    return buildYearPoints(bookOrderData, layout.bookLabels, histSubMode);
  }, [sortMode, bookOrderData, layout, histSubMode]);

  useEffect(() => {
    setYearPoints(yearPoints);
    setYear0WorldX(yearPoints.length > 0 ? yearToWorldX(0, yearPoints) : null);
  }, [yearPoints, setYearPoints, setYear0WorldX]);
}
