import { useEffect, useRef } from 'react';
import { bibleStore }              from '@/store/bible.store';
import { useGraphModeStore }       from '@/store/graphMode.store';
import { useHistoricalDataStore }  from '@/store/historicalData.store';
import type { BookSortMode, HistoricalSubMode } from '@/models/bible';

/** Owns sort mode controls + lazy-loading of kings/periods/events into historicalData.store. */
export function SortFeature() {
  const { sortMode, histSubMode, histSecondaryFrise, setSortMode, setHistSubMode, setHistSecondaryFrise } = useGraphModeStore();
  const { kingsData, periodsData, eventsData, setKingsData, setPeriodsData, setEventsData } = useHistoricalDataStore();

  const kingsRef   = useRef(kingsData);
  const periodsRef = useRef(periodsData);
  const eventsRef  = useRef(eventsData);
  kingsRef.current   = kingsData;
  periodsRef.current = periodsData;
  eventsRef.current  = eventsData;

  useEffect(() => {
    if (sortMode !== 'historical') return;
    if (!kingsRef.current)   bibleStore.kings().then(setKingsData);
    if (!periodsRef.current) bibleStore.periods().then(setPeriodsData);
    if (!eventsRef.current)  bibleStore.events().then(setEventsData);
  }, [sortMode, setKingsData, setPeriodsData, setEventsData]);

  return null;
}
