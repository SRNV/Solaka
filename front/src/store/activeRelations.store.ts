import { create } from 'zustand';
import type { BibleRelation } from '@/models/bible';
import type { BibleTarget } from '@/contexts/BibleDrawerContext';

interface ActiveRelationsState {
  relationsEnabled:     boolean;
  activeRelationsQuery: string;
  drawerRelations:      BibleRelation[]         | null;
  displayRelations:     BibleRelation[]         | null;
  searchHitUuids:       Map<string, string>     | null;
  activeSearchTarget:   BibleTarget             | null;
  setRelationsEnabled:     (v: boolean)                    => void;
  setActiveRelationsQuery: (q: string)                     => void;
  setDrawerRelations:      (r: BibleRelation[] | null)     => void;
  setDisplayRelations:     (r: BibleRelation[] | null)     => void;
  setSearchHitUuids:       (s: Map<string, string> | null) => void;
  setActiveSearchTarget:   (t: BibleTarget | null)         => void;
}

export const useActiveRelationsStore = create<ActiveRelationsState>(set => ({
  relationsEnabled:     false,
  activeRelationsQuery: '',
  drawerRelations:      null,
  displayRelations:     null,
  searchHitUuids:       null,
  activeSearchTarget:   null,
  setRelationsEnabled:     (relationsEnabled)     => set({ relationsEnabled }),
  setActiveRelationsQuery: (activeRelationsQuery) => set({ activeRelationsQuery }),
  setDrawerRelations:      (drawerRelations)      => set({ drawerRelations }),
  setDisplayRelations:     (displayRelations)     => set({ displayRelations }),
  setSearchHitUuids:       (searchHitUuids)       => set({ searchHitUuids }),
  setActiveSearchTarget:   (activeSearchTarget)   => set({ activeSearchTarget }),
}));
