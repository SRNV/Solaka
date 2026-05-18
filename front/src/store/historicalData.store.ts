import { create } from 'zustand';
import type { BibleEvent, HistoricalPeriod, King } from '@/models/bible';

interface HistoricalDataState {
  kingsData:   King[]             | null;
  periodsData: HistoricalPeriod[] | null;
  eventsData:  BibleEvent[]       | null;
  setKingsData:   (d: King[])             => void;
  setPeriodsData: (d: HistoricalPeriod[]) => void;
  setEventsData:  (d: BibleEvent[])       => void;
}

export const useHistoricalDataStore = create<HistoricalDataState>(set => ({
  kingsData:   null,
  periodsData: null,
  eventsData:  null,
  setKingsData:   (kingsData)   => set({ kingsData }),
  setPeriodsData: (periodsData) => set({ periodsData }),
  setEventsData:  (eventsData)  => set({ eventsData }),
}));
