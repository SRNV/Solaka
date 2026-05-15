import { create } from 'zustand';
import type { CommentSummary } from '@/types/patristic.ts';

interface PatristicCommentState {
  summaries: Map<string, CommentSummary>;
  mergeSummaries: (entries: [string, CommentSummary][]) => void;
}

export const usePatristicCommentStore = create<PatristicCommentState>(set => ({
  summaries: new Map(),
  mergeSummaries: (entries) => set(s => {
    const next = new Map(s.summaries);
    for (const [k, v] of entries) next.set(k, v);
    return { summaries: next };
  }),
}));
