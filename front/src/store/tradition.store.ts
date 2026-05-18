import { create } from 'zustand';

interface TraditionState {
  showCath:  boolean;
  showProt:  boolean;
  showPulse: boolean;
  toggleCath:    () => void;
  toggleProt:    () => void;
  togglePulse:   () => void;
  setShowCath:  (v: boolean) => void;
  setShowProt:  (v: boolean) => void;
}

export const useTraditionStore = create<TraditionState>(set => ({
  showCath:    true,
  showProt:    false,
  showPulse:   false,
  toggleCath:    () => set(s => ({ showCath:  !s.showCath })),
  toggleProt:    () => set(s => ({ showProt:  !s.showProt })),
  togglePulse:   () => set(s => ({ showPulse: !s.showPulse })),
  setShowCath:  (showCath)  => set({ showCath }),
  setShowProt:  (showProt)  => set({ showProt }),
}));
