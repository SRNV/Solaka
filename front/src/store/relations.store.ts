import { create } from 'zustand';

export interface VerseRef {
  bookName: string;
  chapterNumber: number;
  verseNumber: number;
}

export interface RelRow {
  from:       string;
  toFrom:     string;
  toTo:       string;
  trad:       'c' | 'p';
  relType:    string;
  toFromRef?: VerseRef;
  toToRef?:   VerseRef;
  isRange?:   boolean;
  sourceUrl?: string | null;
}

export const getRelKey = (rel: { from: string; toFrom: string }) =>
  `${rel.from}${rel.toFrom}`;

// UUIDs whose outgoing relations have been fully streamed (never cleared)
export const relsFetched = new Set<string>();

interface RelationsState {
  rels:   Record<string, RelRow>;    // relKey → RelRow
  byFrom: Record<string, string[]>;  // uuid   → relKey[] (source index)
  addBatch: (batch: RelRow[]) => void;
}

export const useRelationsStore = create<RelationsState>()(set => ({
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
