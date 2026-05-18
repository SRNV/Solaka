import { useCallback, useEffect, useRef } from 'react';
import type { BibleBookOrder } from '@/models/bible';
import { useBibleDrawer }      from '@/contexts/BibleDrawerContext';
import { useTimelineStore }    from '@/store/timeline.store';
import { useGraphModeStore }   from '@/store/graphMode.store';
import { useYearMarkersStore } from '@/store/yearMarkers.store';
import { worldXToYear, yearToWorldX } from './friseUtils';
import { TimelineControls }    from './TimelineControls';
import styles from './GraphPage.module.css';

interface Props {
  bookOrderData:        BibleBookOrder[] | null;
  mainCanvasWrapperRef: React.RefObject<HTMLDivElement | null>;
  mainCamRef:           React.RefObject<{ x: number; zoom: number }>;
  yearRange:            { min: number; max: number } | null;
}

/** Owns all timeline/scrubber DOM logic: play controls + invisible drag handle. */
export function ScrubberFeature({ bookOrderData, mainCanvasWrapperRef, mainCamRef, yearRange }: Props) {
  const { isPlaying, playSpeed, play, pause, setSpeed, stop } = useTimelineStore();
  const { sortMode, histSubMode, setSortMode }                 = useGraphModeStore();
  const { setHistoricalDate, historicalDate, open }            = useBibleDrawer();
  const { yearPoints, setScrubberHandleEl, setScrubberWorldX } = useYearMarkersStore();

  const historicalDateRef = useRef(historicalDate);
  historicalDateRef.current = historicalDate;

  const handleRef = useCallback((el: HTMLDivElement | null) => setScrubberHandleEl(el), [setScrubberHandleEl]);

  // Keep scrubberWorldX in store in sync with historicalDate
  useEffect(() => {
    setScrubberWorldX(
      historicalDate != null && yearPoints.length > 0
        ? yearToWorldX(historicalDate, yearPoints)
        : null
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
      if (!isDrag || !mainCanvasWrapperRef.current || yearPoints.length === 0) return;
      const rect   = mainCanvasWrapperRef.current.getBoundingClientRect();
      const worldX = (me.clientX - (rect.left + rect.width / 2)) / mainCamRef.current.zoom + mainCamRef.current.x;
      setHistoricalDate(Math.round(worldXToYear(worldX, yearPoints)));
    };

    const onUp = (me: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',  onUp);
      if (!isDrag && mainCanvasWrapperRef.current && yearPoints.length > 0 && bookOrderData) {
        const rect   = mainCanvasWrapperRef.current.getBoundingClientRect();
        const worldX = (me.clientX - (rect.left + rect.width / 2)) / mainCamRef.current.zoom + mainCamRef.current.x;
        const year   = Math.round(worldXToYear(worldX, yearPoints));
        const closest = bookOrderData.reduce((best, b) => {
          const mid     = (b[histSubMode][0] + b[histSubMode][1]) / 2;
          const bestMid = (best[histSubMode][0] + best[histSubMode][1]) / 2;
          return Math.abs(mid - year) < Math.abs(bestMid - year) ? b : best;
        });
        open({ book: closest.name, chapter: 1 });
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',  onUp);
  }, [yearPoints, mainCanvasWrapperRef, mainCamRef, setHistoricalDate, bookOrderData, histSubMode, open]);

  return (
    <>
      <TimelineControls
        isPlaying={isPlaying}
        playSpeed={playSpeed}
        isHistorical={sortMode === 'historical'}
        onTogglePlay={handlePlay}
        onSpeedChange={setSpeed}
        onClose={handleClose}
      />
      {sortMode === 'historical' && (
        <div
          ref={handleRef}
          className={styles.scrubberHandle}
          onMouseDown={handleScrubberMouseDown}
        />
      )}
    </>
  );
}
