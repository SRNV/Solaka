import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { BibleBookOrder } from '@/models/bible';
import { useBibleDrawer }      from '@/contexts/BibleDrawerContext';
import { useTimelineStore }    from '@/store/timeline.store';
import { useGraphModeStore }   from '@/store/graphMode.store';
import { useYearMarkersStore } from '@/store/yearMarkers.store';
import { worldXToYear, yearToWorldX } from './friseUtils';

export const SPEEDS = [0.5, 1, 2, 5];

export function useTimeline(bookOrderData: BibleBookOrder[] | null) {
  const { isPlaying, playSpeed, play, pause, setSpeed, stop } = useTimelineStore();
  const { sortMode, histSubMode, setSortMode }                 = useGraphModeStore();
  const { setHistoricalDate, historicalDate, open, target }    = useBibleDrawer();
  const { yearPoints, setScrubberHandleEl, setScrubberWorldX } = useYearMarkersStore();

  const yearRange = useMemo(() => {
    if (sortMode !== 'historical' || !bookOrderData) return null;
    const years = bookOrderData.flatMap(b => [b[histSubMode][0], b[histSubMode][1]]);
    return { min: Math.min(...years), max: Math.max(...years) };
  }, [sortMode, bookOrderData, histSubMode]);

  // When drawer opens a book in historical mode, move scrubber to that book's date
  useEffect(() => {
    if (sortMode === 'historical' && target && bookOrderData) {
      const book = bookOrderData.find(b => b.name === target.book);
      if (book?.[histSubMode]) setHistoricalDate(book[histSubMode]![0]);
    } else {
      setHistoricalDate(null);
    }
  }, [target, bookOrderData, histSubMode, setHistoricalDate, sortMode]);

  const historicalDateRef = useRef(historicalDate);
  historicalDateRef.current = historicalDate;

  const handleRef = useCallback(
    (el: HTMLDivElement | null) => setScrubberHandleEl(el),
    [setScrubberHandleEl],
  );

  useEffect(() => {
    setScrubberWorldX(
      historicalDate != null && yearPoints.length > 0
        ? yearToWorldX(historicalDate, yearPoints)
        : null,
    );
  }, [historicalDate, yearPoints, setScrubberWorldX]);

  // Play interval at 15 Hz
  useEffect(() => {
    if (!isPlaying || !yearRange) return;
    const id = setInterval(() => {
      const next = Math.round((historicalDateRef.current ?? yearRange.min) + playSpeed);
      if (next >= yearRange.max) { setHistoricalDate(yearRange.max); pause(); }
      else setHistoricalDate(next);
    }, Math.round(1000 / 15));
    return () => clearInterval(id);
  }, [isPlaying, playSpeed, yearRange, setHistoricalDate, pause]);

  const handlePlay = useCallback(() => {
    const atEnd = yearRange != null && (historicalDate == null || historicalDate >= yearRange.max);
    switch (true) {
      case !isPlaying && sortMode !== 'historical':
        setSortMode('historical');
        if (yearRange) setHistoricalDate(yearRange.min);
        play();
        break;
      case !isPlaying && atEnd:
        if (yearRange) setHistoricalDate(yearRange.min);
        play();
        break;
      case !isPlaying:
        play();
        break;
      default:
        pause();
    }
  }, [isPlaying, sortMode, historicalDate, yearRange, setSortMode, setHistoricalDate, play, pause]);

  const handleClose = useCallback(() => {
    stop();
    setSortMode('classic');
  }, [stop, setSortMode]);

  const handleScrubberMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startTime    = Date.now();
    const startClientX = e.clientX;
    let isDrag = false;

    const onMove = (me: MouseEvent) => {
      if (!isDrag && (Date.now() - startTime > 150 || Math.abs(me.clientX - startClientX) > 3)) isDrag = true;
      if (!isDrag) return;
      const { canvasContainerEl, cameraX, cameraZoom, yearPoints: yp } = useYearMarkersStore.getState();
      if (!canvasContainerEl || yp.length === 0) return;
      const rect   = canvasContainerEl.getBoundingClientRect();
      const worldX = (me.clientX - (rect.left + rect.width / 2)) / cameraZoom + cameraX;
      setHistoricalDate(Math.round(worldXToYear(worldX, yp)));
      
      // Need to force re-render/frame if loop is 'demand'
      useYearMarkersStore.getState().invalidateCanvas?.();
    };

    const onUp = (me: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',  onUp);
      if (isDrag || !bookOrderData) return;
      const { canvasContainerEl, cameraX, cameraZoom, yearPoints: yp } = useYearMarkersStore.getState();
      if (!canvasContainerEl || yp.length === 0) return;
      const rect    = canvasContainerEl.getBoundingClientRect();
      const worldX  = (me.clientX - (rect.left + rect.width / 2)) / cameraZoom + cameraX;
      const year    = Math.round(worldXToYear(worldX, yp));
      const closest = bookOrderData.reduce((best, b) => {
        const mid     = (b[histSubMode][0] + b[histSubMode][1]) / 2;
        const bestMid = (best[histSubMode][0] + best[histSubMode][1]) / 2;
        return Math.abs(mid - year) < Math.abs(bestMid - year) ? b : best;
      });
      open({ book: closest.name, chapter: 1 });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',  onUp);
  }, [bookOrderData, histSubMode, setHistoricalDate, open]);

  return {
    isPlaying, playSpeed, sortMode, SPEEDS,
    handlePlay, handleClose, handleScrubberMouseDown, handleRef, setSpeed,
  };
}
