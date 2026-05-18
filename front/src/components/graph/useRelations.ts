import { useEffect, useRef } from 'react';
import { useStompRelations }     from '@/hooks/useStompRelations';
import { useRelationsStream }    from './useRelationsStream';
import { useRelationsStore, relsFetched } from '@/store/relations.store';
import { useActiveRelationsStore }        from '@/store/activeRelations.store';
import { useTraditionStore }             from '@/store/tradition.store';
import { useBibleDrawer }                from '@/contexts/BibleDrawerContext';
import type { BibleRelation }            from '@/models/bible';
import type { LayoutResult }             from '@/utils/graphLayout';

/**
 * Owns all relations data-flow: STOMP subscription, stream merge, drawer→map effect.
 * Writes displayRelations to activeRelations.store. Returns stompRelations for useSearchBadges.
 */
export function useRelations(layout: LayoutResult | null) {
  const {
    relationsEnabled, activeRelationsQuery, drawerRelations,
    setDrawerRelations, setActiveRelationsQuery, setRelationsEnabled, setDisplayRelations,
  } = useActiveRelationsStore();

  const { showCath, showProt } = useTraditionStore();
  const { showInMapCount, mapTargets, target, targets } = useBibleDrawer();

  const { relations: stompRelations } = useStompRelations(relationsEnabled, showCath, showProt, activeRelationsQuery);
  const displayRelations = useRelationsStream(stompRelations, drawerRelations, layout);

  useEffect(() => {
    setDisplayRelations(displayRelations);
  }, [displayRelations, setDisplayRelations]);

  // ── Drawer → map relations ──────────────────────────────────────────────
  const lastShowInMapCount = useRef(0);
  const layoutRef = useRef<LayoutResult | null>(null);
  layoutRef.current = layout;

  useEffect(() => {
    if (showInMapCount === 0 || showInMapCount === lastShowInMapCount.current) return;
    lastShowInMapCount.current = showInMapCount;
    const activeTargets = mapTargets ?? (targets.length > 0 ? targets : target ? [target] : []);
    if (!activeTargets.length) return;

    setDrawerRelations(null);

    const currentLayout = layoutRef.current;
    if (currentLayout) {
      const storeState = useRelationsStore.getState();
      const fromStore: BibleRelation[] = [];
      const targetKeys = new Set(activeTargets.map(t => `${t.book}|${t.chapter}`));
      for (const [uuid, ref] of currentLayout.uuidRefMap) {
        if (!targetKeys.has(`${ref.book}|${ref.chapter}`)) continue;
        if (!relsFetched.has(uuid)) continue;
        for (const key of (storeState.byFrom[uuid] ?? [])) {
          const row = storeState.rels[key];
          if (!row) continue;
          fromStore.push({ from: row.from, toFrom: row.toFrom, toTo: row.toTo, trad: row.trad, relType: row.relType });
        }
      }
      if (fromStore.length > 0) setDrawerRelations(fromStore);
    }

    const q = activeTargets.map(t => {
      const v = t.verse != null ? ` ${t.verse}${t.verseTo && t.verseTo !== t.verse ? `–${t.verseTo}` : ''}` : '';
      return `${t.book} ${t.chapter}${v}`;
    }).join(';');
    setActiveRelationsQuery(q);
    setRelationsEnabled(true);
  }, [showInMapCount, mapTargets]); // targets/target resolved from closure

  return { stompRelations };
}
