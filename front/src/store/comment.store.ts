import { create } from 'zustand';
import type { PatristicCommentState } from '@/models/stores';

export const usePatristicCommentStore = create<PatristicCommentState>(set => ({
  summaries: new Map(),
  mergeSummaries: (entries) => set(s => {
    const next = new Map(s.summaries);
    for (const [k, v] of entries) next.set(k, v);
    return { summaries: next };
  }),
}));
