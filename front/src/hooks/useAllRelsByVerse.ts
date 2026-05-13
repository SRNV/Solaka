import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useRelationsStore, type RelRow } from '@/store/relations.store.ts';

export function useAllRelsByVerse(uuids: string[]): Map<string, RelRow[]> {
  const { rels, byFrom } = useRelationsStore(
    useShallow(s => ({ rels: s.rels, byFrom: s.byFrom })),
  );
  return useMemo(() => {
    const map = new Map<string, RelRow[]>();
    for (const uuid of uuids) {
      const keys = byFrom[uuid] ?? [];
      map.set(uuid, keys.map(k => rels[k]).filter(Boolean));
    }
    return map;
  }, [uuids, rels, byFrom]);
}
