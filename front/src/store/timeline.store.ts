import { create } from 'zustand';

interface TimelineState {
  isPlaying: boolean;
  playSpeed: number;
  play:      () => void;
  pause:     () => void;
  setSpeed:  (s: number) => void;
  stop:      () => void;
}

export const useTimelineStore = create<TimelineState>(set => ({
  isPlaying: false,
  playSpeed: 5,
  play:      () => set({ isPlaying: true }),
  pause:     () => set({ isPlaying: false }),
  setSpeed:  (s) => set({ playSpeed: s }),
  stop:      () => set({ isPlaying: false }),
}));
