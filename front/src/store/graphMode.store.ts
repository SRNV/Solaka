import { create } from 'zustand';
import type { BookSortMode, HistoricalSubMode } from '@/models/bible';

export type FriseType = 'kings' | 'periods' | 'events';

interface GraphModeState {
  sortMode:           BookSortMode;
  histSubMode:        HistoricalSubMode;
  histSecondaryFrise: FriseType;
  setSortMode:           (mode: BookSortMode)       => void;
  setHistSubMode:        (sub: HistoricalSubMode)   => void;
  setHistSecondaryFrise: (frise: FriseType)         => void;
}

export const useGraphModeStore = create<GraphModeState>(set => ({
  sortMode:           'classic',
  histSubMode:        'authorPeriod',
  histSecondaryFrise: 'kings',
  setSortMode:           (sortMode)           => set({ sortMode }),
  setHistSubMode:        (histSubMode)        => set({ histSubMode }),
  setHistSecondaryFrise: (histSecondaryFrise) => set({ histSecondaryFrise }),
}));
