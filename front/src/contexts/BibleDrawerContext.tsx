import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { BibleTarget, ArcRef, BibleDrawerCtx } from '@/models/contexts';

export type { BibleTarget, ArcRef };

const Ctx = createContext<BibleDrawerCtx | null>(null);

export function BibleDrawerProvider({ children }: { children: ReactNode }) {
  const [target,         setTarget]         = useState<BibleTarget | null>(null);
  const [targets,        setTargets]        = useState<BibleTarget[]>([]);
  const [openArc,        setOpenArc]        = useState<ArcRef | null>(null);
  const [showInMapCount, setShowInMapCount] = useState(0);
  const [mapTargets,     setMapTargets]     = useState<BibleTarget[] | null>(null);
  const [historicalDate, setHistoricalDate] = useState<number | null>(null);

  const open     = useCallback((t: BibleTarget) => { setTarget(t); setTargets([]); setOpenArc(null); }, []);
  const openMany = useCallback((ts: BibleTarget[], arc?: ArcRef) => {
    setTargets(ts); setTarget(null); setOpenArc(arc ?? null);
  }, []);
  const close    = useCallback(() => { setTarget(null); setTargets([]); setOpenArc(null); }, []);
  const triggerShowInMap = useCallback((ts?: BibleTarget[]) => {
    setMapTargets(ts ?? null);
    setShowInMapCount(n => n + 1);
  }, []);

  return (
    <Ctx.Provider value={{ 
      target, targets, openArc, showInMapCount, mapTargets, historicalDate,
      open, openMany, close, triggerShowInMap, setHistoricalDate 
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useBibleDrawer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBibleDrawer must be used inside BibleDrawerProvider');
  return ctx;
}
