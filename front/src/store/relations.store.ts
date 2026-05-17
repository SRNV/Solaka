import { create } from 'zustand';
import type { VerseRef, RelRow, RelationsState } from '@/models/stores';

export type { VerseRef, RelRow };

export const getRelKey = (rel: { from: string; toFrom: string }) =>
  `${rel.from}${rel.toFrom}`;

// UUIDs whose outgoing relations have been fully streamed (never cleared)
export const relsFetched = new Set<string>();

export const useRelationsStore = create<RelationsState>(set => ({
  rels:   {},
  byFrom: {},

  addBatch: (batch) => set(state => {
    const newRels   = { ...state.rels };
    const newByFrom = { ...state.byFrom };

    for (const r of batch) {
      const key = getRelKey(r);
      if (newRels[key]) continue; // already stored
      newRels[key] = r;
      if (!newByFrom[r.from]) newByFrom[r.from] = [];
      newByFrom[r.from] = [...newByFrom[r.from], key];
    }

    return { rels: newRels, byFrom: newByFrom };
  }),
}));

/** Selector: toutes les relations dont `uuid` est la source */
export const selectRelationsFrom = (uuid: string) => (state: RelationsState) =>
  (state.byFrom[uuid] ?? []).map(k => state.rels[k]).filter(Boolean);
