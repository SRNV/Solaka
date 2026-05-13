import { useMemo, useRef, useState } from 'react';
import { Html, Line } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { BibleBookOrder, BibleEvent, HistoricalPeriod, HistoricalSubMode, King, BookSortMode } from '@/types/bible.ts';
import type { BibleTarget } from '@/contexts/BibleDrawerContext.tsx';
import type { LayoutResult } from '@/utils/graphLayout.ts';
import type { BibleStructureBook } from '@/types/bible.ts';

interface SectionMarkersProps {
  layout:              LayoutResult;
  hoveredBook:         string | null;
  mainCamRef:          React.MutableRefObject<{ x: number; zoom: number }>;
  sortMode:            BookSortMode;
  histSubMode:         HistoricalSubMode;
  histSecondaryFrise:  'kings' | 'periods' | 'events';
  bookOrderData:       BibleBookOrder[] | null;
  sortedData:          BibleStructureBook[] | null;
  kings:               King[] | null;
  periods:             HistoricalPeriod[] | null;
  events:              BibleEvent[] | null;
  setHistoricalDate:   (date: number | null) => void;
  target:              BibleTarget | null;
}

// Y offsets inside the markers canvas (smaller canvas, separate from the main graph canvas)
const SECTION_Y     = 80;
const LABEL_Y       = 60;
const SECONDARY_Y   = 30;
const K_TICK        = 8;
const PIN_H         = 14;
const BY            = 100;
const TICK          = 6;

const COLOR_BY_EVENT_TYPE: Record<string, string> = {
  covenant: '#f0c040', exodus: '#e8956d', conquest: '#e05555',
  monarchy: '#826AED', temple: '#4caf50', exile: '#c0392b',
  return: '#27ae60', reform: '#2980b9', political: '#a0a8c8',
  birth: '#f9dc5c', death: '#888', theological: '#ffffff', prophecy: '#bb8fce',
  writing: '#85c1e9', martyrdom: '#e74c3c', council: '#5dade2',
  revolt: '#e59866', migration: '#a9cce3', missionary: '#a9dfbf',
};

/** Interpolate a world-space X coordinate from a year using the year→X mapping. */
function yearToWorldX(year: number, yearPoints: { year: number; x: number }[]): number {
  if (yearPoints.length === 0) return 0;
  if (yearPoints.length === 1) return yearPoints[0].x;

  if (year <= yearPoints[0].year) {
    const p0 = yearPoints[0], p1 = yearPoints[1];
    return p0.x + ((p1.x - p0.x) / (p1.year - p0.year)) * (year - p0.year);
  }
  if (year >= yearPoints[yearPoints.length - 1].year) {
    const p0 = yearPoints[yearPoints.length - 2], p1 = yearPoints[yearPoints.length - 1];
    return p1.x + ((p1.x - p0.x) / (p1.year - p0.year)) * (year - p1.year);
  }
  for (let i = 0; i < yearPoints.length - 1; i++) {
    const p0 = yearPoints[i], p1 = yearPoints[i + 1];
    if (year >= p0.year && year <= p1.year) {
      return p0.x + ((p1.x - p0.x) / (p1.year - p0.year)) * (year - p0.year);
    }
  }
  return 0;
}

function buildYearPoints(bookOrderData: BibleBookOrder[], bookLabels: LayoutResult['bookLabels'], histSubMode: HistoricalSubMode) {
  const dateMap   = new Map(bookOrderData.map(b => [b.number, b[histSubMode]]));
  const yearToXs  = new Map<number, number[]>();
  for (const b of bookLabels) {
    const dateRange = dateMap.get(b.number);
    if (!dateRange) continue;
    const year = dateRange[0];
    if (!yearToXs.has(year)) yearToXs.set(year, []);
    yearToXs.get(year)!.push((b.startX + b.endX) / 2);
  }
  const pts: { year: number; x: number }[] = [];
  for (const [year, xs] of yearToXs.entries()) {
    pts.push({ year, x: xs.reduce((a, b) => a + b, 0) / xs.length });
  }
  pts.sort((a, b) => a.year - b.year);
  return pts;
}

export function SectionMarkers({
  layout, hoveredBook, mainCamRef,
  sortMode, histSubMode, histSecondaryFrise,
  bookOrderData, sortedData,
  kings, periods, events,
  setHistoricalDate, target,
}: SectionMarkersProps) {
  const { viewport, size } = useThree();
  const [sync, setSync] = useState(() => ({ x: mainCamRef.current.x, zoom: mainCamRef.current.zoom }));

  useFrame(() => {
    const { x, zoom } = mainCamRef.current;
    if (x !== sync.x || zoom !== sync.zoom) setSync({ x, zoom });
  });

  const hoveredBookRange = hoveredBook
    ? layout.bookLabels.find(b => b.name === hoveredBook) ?? null
    : null;

  const px = viewport.height / size.height;

  // ── Classic mode: AT / NT section markers ─────────────────────────────
  const classicSections = useMemo(() => {
    if (sortMode !== 'classic' || !layout.bookLabels.length) return [];
    const groups: { name: string; startX: number; endX: number; books: string[] }[] = [];
    let currentSection: 'AT' | 'NT' | null = null;
    let currentStart = 0;
    let currentBooks: string[] = [];

    for (let i = 0; i < layout.bookLabels.length; i++) {
      const b         = layout.bookLabels[i];
      const sectionId = b.number >= 46 ? 'NT' : 'AT';
      if (sectionId !== currentSection) {
        if (currentSection) {
          groups.push({
            name:   currentSection === 'AT' ? 'ANCIEN TESTAMENT' : 'NOUVEAU TESTAMENT',
            startX: currentStart,
            endX:   layout.bookLabels[i - 1].endX,
            books:  currentBooks,
          });
        }
        currentSection = sectionId;
        currentStart   = b.startX;
        currentBooks   = [b.name];
      } else {
        currentBooks.push(b.name);
      }
    }
    if (currentSection) {
      groups.push({
        name:   currentSection === 'AT' ? 'ANCIEN TESTAMENT' : 'NOUVEAU TESTAMENT',
        startX: currentStart,
        endX:   layout.bookLabels[layout.bookLabels.length - 1].endX,
        books:  currentBooks,
      });
    }
    return groups;
  }, [layout.bookLabels, sortMode]);

  // ── Size mode: verse count labels per book ─────────────────────────────
  const sizeItems = useMemo(() => {
    if (sortMode !== 'size' || !layout.bookLabels.length) return [];
    const items: { label: string; x: number; startX: number; endX: number; books: string[]; priority: number }[] = [];
    let current: { label: string; startX: number; endX: number; books: string[]; priority: number } | null = null;

    for (const b of layout.bookLabels) {
      const verseCount = (sortedData?.find(sd => sd.number === b.number)?.chapters ?? [])
        .reduce((s, ch) => s + (ch?.verseCount ?? 0), 0);
      const label    = `${verseCount} versets`;
      const priority = verseCount > 1000 ? 3 : verseCount > 500 ? 2 : verseCount > 100 ? 1 : 0;

      if (!current || current.label !== label) {
        if (current) items.push({ ...current, x: (current.startX + current.endX) / 2 });
        current = { label, startX: b.startX, endX: b.endX, books: [b.name], priority };
      } else {
        current.endX = b.endX;
        current.books.push(b.name);
        current.priority = Math.max(current.priority, priority);
      }
    }
    if (current) items.push({ ...current, x: (current.startX + current.endX) / 2 });
    return items;
  }, [sortMode, layout.bookLabels, sortedData]);

  // ── Historical mode: date labels along timeline ─────────────────────────
  const timelineItems = useMemo(() => {
    if (sortMode !== 'historical' || !bookOrderData || !layout.bookLabels.length) return [];
    const dateMap = new Map(bookOrderData.map(b => [b.number, b[histSubMode]]));
    const items: { label: string; x: number; startX: number; endX: number; books: string[]; priority: number }[] = [];
    let current: { label: string; startX: number; endX: number; books: string[]; priority: number } | null = null;

    const fmtYear = (y: number) => {
      const abs = Math.abs(y);
      if (y === 0) return '0';
      return y < 0 ? `${abs} av. J.-C.` : `${abs} ap. J.-C.`;
    };
    const yearPriority = (y: number) => {
      if (y % 1000 === 0) return 4; if (y % 500 === 0) return 3;
      if (y % 100  === 0) return 2; if (y % 50  === 0) return 1;
      return 0;
    };

    for (const b of layout.bookLabels) {
      const dateRange = dateMap.get(b.number);
      if (!dateRange) continue;
      const label    = fmtYear(dateRange[0]);
      const priority = yearPriority(dateRange[0]);

      if (!current || current.label !== label) {
        if (current) items.push({ ...current, x: (current.startX + current.endX) / 2 });
        current = { label, startX: b.startX, endX: b.endX, books: [b.name], priority };
      } else {
        current.endX = b.endX;
        current.books.push(b.name);
        current.priority = Math.max(current.priority, priority);
      }
    }
    if (current) items.push({ ...current, x: (current.startX + current.endX) / 2 });
    return items;
  }, [sortMode, histSubMode, bookOrderData, layout.bookLabels]);

  // ── Kings + periods + events for historical frises ─────────────────────
  const yearPoints = useMemo(() => {
    if (sortMode !== 'historical' || !bookOrderData || !layout.bookLabels.length) return [];
    return buildYearPoints(bookOrderData, layout.bookLabels, histSubMode);
  }, [sortMode, bookOrderData, layout.bookLabels, histSubMode]);

  const kingItems = useMemo(() => {
    if (sortMode !== 'historical' || !kings || !yearPoints.length) return [];
    return kings.map(k => ({
      ...k,
      startX:   yearToWorldX(k.reign.start, yearPoints),
      endX:     k.reign.end === null ? layout.totalX : yearToWorldX(k.reign.end, yearPoints),
      priority: k.saint ? 3 : (k.kingdom.israel && k.kingdom.judah) ? 2 : 1,
    }));
  }, [sortMode, kings, yearPoints, layout.totalX]);

  const periodItems = useMemo(() => {
    if (sortMode !== 'historical' || !periods || !yearPoints.length) return [];
    return periods.map(p => ({
      ...p,
      startX: yearToWorldX(p.start, yearPoints),
      endX:   yearToWorldX(p.end, yearPoints),
    }));
  }, [sortMode, periods, yearPoints]);

  const eventItems = useMemo(() => {
    if (sortMode !== 'historical' || !events || !yearPoints.length) return [];
    return events.map(e => ({ ...e, x: yearToWorldX(e.year, yearPoints) }));
  }, [sortMode, events, yearPoints]);

  // ── Clutter management: hide overlapping labels ────────────────────────
  const rawItems = sortMode === 'historical' ? timelineItems : sortMode === 'size' ? sizeItems : classicSections;

  const renderItems = useMemo(() => {
    if (sortMode === 'classic') return rawItems.map(item => ({ ...item, visible: true }));

    const MIN_DIST = 110 * px;
    const byPriority = [...rawItems].sort((a, b) => ((b as any).priority ?? 0) - ((a as any).priority ?? 0));
    const result = rawItems.map(item => ({ ...item, visible: false }));
    const shownXs: number[] = [];

    if (result.length > 0) {
      (result[0] as any).visible = true;
      shownXs.push((result[0].startX + result[0].endX) / 2 * sync.zoom - sync.x * sync.zoom);
      if (result.length > 1) {
        const last = result[result.length - 1];
        (last as any).visible = true;
        shownXs.push((last.startX + last.endX) / 2 * sync.zoom - sync.x * sync.zoom);
      }
    }

    for (const item of byPriority) {
      const screenX = ((item.startX + item.endX) / 2) * sync.zoom - sync.x * sync.zoom;
      if (shownXs.every(sx => Math.abs(screenX - sx) >= MIN_DIST)) {
        const idx = result.findIndex(r => r.startX === item.startX && r.endX === item.endX);
        if (idx >= 0) (result[idx] as any).visible = true;
        shownXs.push(screenX);
      }
    }
    return result;
  }, [rawItems, sortMode, sync.zoom, sync.x, px]);

  const renderKings = useMemo(() => {
    if (sortMode !== 'historical' || !kingItems.length) return { items: [], baselines: [] as { x1: number; x2: number; y: number }[] };
    const MIN_KING_DIST = 80 * px;
    const sorted = [...kingItems].sort((a, b) => b.priority - a.priority);
    const visible: typeof kingItems = [];
    const shownXs: number[] = [];
    for (const k of sorted) {
      const midX = ((k.startX + k.endX) / 2) * sync.zoom - sync.x * sync.zoom;
      if (shownXs.every(sx => Math.abs(midX - sx) >= MIN_KING_DIST)) {
        visible.push(k);
        shownXs.push(midX);
      }
    }
    const items  = kingItems.map(k => ({ ...k, visible: visible.some(v => v.name === k.name) }));
    const minX   = Math.min(...items.map(k => k.startX));
    const maxX   = Math.max(...items.map(k => k.endX));
    return { items, baselines: [{ x1: minX, x2: maxX, y: SECONDARY_Y }] };
  }, [kingItems, sortMode, sync.zoom, sync.x, px]);

  const renderPeriods = useMemo(() => {
    if (sortMode !== 'historical' || !periodItems.length) return { items: [] as typeof periodItems };
    const MIN_PERIOD_DIST = 80 * px;
    const sorted = [...periodItems].sort((a, b) => (b.endX - b.startX) - (a.endX - a.startX));
    const visible: typeof periodItems = [];
    const shownXs: number[] = [];
    for (const p of sorted) {
      const midX = ((p.startX + p.endX) / 2) * sync.zoom - sync.x * sync.zoom;
      if (shownXs.every(sx => Math.abs(midX - sx) >= MIN_PERIOD_DIST)) {
        visible.push(p);
        shownXs.push(midX);
      }
    }
    return { items: periodItems.map(p => ({ ...p, visible: visible.some(v => v.name === p.name) })) };
  }, [periodItems, sortMode, sync.zoom, sync.x, px]);

  const renderEvents = useMemo(() => {
    if (sortMode !== 'historical' || !eventItems.length) return [];
    const MIN_EVENT_DIST = 40 * px;
    const sorted = [...eventItems].sort((a, b) => {
      const priorityOrder = { major: 3, middle: 2, minor: 1 };
      return (priorityOrder[b.priority] ?? 0) - (priorityOrder[a.priority] ?? 0);
    });
    const shownXs: number[] = [];
    return eventItems.map(e => {
      const screenX = e.x * sync.zoom - sync.x * sync.zoom;
      const show    = sorted.indexOf(e) < 3 || shownXs.every(sx => Math.abs(screenX - sx) >= MIN_EVENT_DIST);
      if (show) shownXs.push(screenX);
      return { ...e, visible: show };
    });
  }, [eventItems, sortMode, sync.zoom, sync.x, px]);

  const halfViewport = viewport.width / 2;

  return (
    <group>
      {/* Section / date / size labels */}
      {renderItems.map((section, i) => {
        const isHovered  = section.books.includes(hoveredBook ?? '');
        const color      = isHovered ? '#826AED' : '#a0a8c8';
        const lineWidth  = isHovered ? 2.5 : 1.2;
        const worldStart = section.startX * sync.zoom - sync.x * sync.zoom;
        const worldEnd   = section.endX   * sync.zoom - sync.x * sync.zoom;
        const isInView   = worldStart <= halfViewport && worldEnd >= -halfViewport;
        const visStart   = Math.max(worldStart, -halfViewport);
        const visEnd     = Math.min(worldEnd,    halfViewport);
        const centerX    = (visStart + visEnd) / 2;
        const name       = (section as any).name || (section as any).label;

        return (
          <group key={i}>
            <Line
              points={[[worldStart, BY + TICK, 0], [worldStart, BY, 0], [worldEnd, BY, 0], [worldEnd, BY + TICK, 0]]}
              color={color} lineWidth={lineWidth} transparent opacity={0.4}
            />
            {isInView && (section as any).visible && (
              <Html position={[centerX, LABEL_Y, 0]} center zIndexRange={[0, 0]}>
                <div
                  onMouseEnter={() => {
                    if (sortMode === 'historical' && bookOrderData) {
                      const bOrder = bookOrderData.find(b => b.name === section.books[0]);
                      if (bOrder?.[histSubMode]) setHistoricalDate(bOrder[histSubMode]![0]);
                    }
                  }}
                  onMouseLeave={() => { if (sortMode === 'historical') setHistoricalDate(null); }}
                  style={{
                    color, fontSize: '9px', fontWeight: 900, letterSpacing: '1px',
                    whiteSpace: 'nowrap', opacity: 0.75, cursor: sortMode === 'historical' ? 'pointer' : 'default',
                    userSelect: 'none', textTransform: 'uppercase', pointerEvents: 'auto',
                  }}
                >
                  {name}
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* Kings baseline */}
      {histSecondaryFrise === 'kings' && renderKings.baselines.map((b, i) => (
        <Line
          key={`king-base-${i}`}
          points={[[b.x1 * sync.zoom - sync.x * sync.zoom, b.y, 0], [b.x2 * sync.zoom - sync.x * sync.zoom, b.y, 0]]}
          color="#a0a8c8" lineWidth={1.2} transparent opacity={0.15}
        />
      ))}

      {/* Kings */}
      {histSecondaryFrise === 'kings' && renderKings.items.map((king, i) => {
        const x1    = king.startX * sync.zoom - sync.x * sync.zoom;
        const x2    = king.endX   * sync.zoom - sync.x * sync.zoom;
        const isHov = hoveredBookRange ? king.startX <= hoveredBookRange.endX && king.endX >= hoveredBookRange.startX : false;
        const baseColor = king.saint ? '#4caf50' : (king.kingdom.judah && king.kingdom.israel) ? '#826AED' : king.kingdom.judah ? '#e8956d' : '#85c1e9';
        const lineColor = isHov ? '#C879FF' : '#a0a8c8';
        const isInView  = x1 <= halfViewport && x2 >= -halfViewport;
        const midX      = (Math.max(x1, -halfViewport) + Math.min(x2, halfViewport)) / 2;

        return (
          <group key={`king-${i}`}>
            <Line
              points={[[x1, SECONDARY_Y + K_TICK, 0], [x1, SECONDARY_Y, 0], [x2, SECONDARY_Y, 0], [x2, SECONDARY_Y + K_TICK, 0]]}
              color={lineColor} lineWidth={isHov ? 2.5 : 1.2} transparent opacity={isHov ? 1 : 0.4}
            />
            {king.visible && isInView && (
              <Html position={[midX, SECONDARY_Y - 18 * px, 0]} center>
                <div
                  onMouseEnter={() => { if (sortMode === 'historical') setHistoricalDate(king.reign.start); }}
                  onMouseLeave={() => { if (sortMode === 'historical') setHistoricalDate(null); }}
                  style={{
                    color: isHov ? baseColor : '#a0a8c8', fontSize: '9px', fontWeight: 900,
                    letterSpacing: '1px', whiteSpace: 'nowrap', cursor: 'pointer',
                    userSelect: 'none', textTransform: 'uppercase', opacity: isHov ? 1 : 0.45, pointerEvents: 'auto',
                  }}
                >
                  {king.name}
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* Periods */}
      {histSecondaryFrise === 'periods' && renderPeriods.items.map((period, i) => {
        const x1        = period.startX * sync.zoom - sync.x * sync.zoom;
        const x2        = period.endX   * sync.zoom - sync.x * sync.zoom;
        const isHov     = hoveredBookRange ? period.startX <= hoveredBookRange.endX && period.endX >= hoveredBookRange.startX : false;
        const baseColor = period.type === 'domination' ? '#e8956d' : period.type === 'exile' ? '#c0392b' : '#7f8c8d';
        const lineColor = isHov ? '#C879FF' : '#a0a8c8';
        const isInView  = x1 <= halfViewport && x2 >= -halfViewport;
        const midX      = (Math.max(x1, -halfViewport) + Math.min(x2, halfViewport)) / 2;

        return (
          <group key={`period-${i}`}>
            <Line
              points={[[x1, SECONDARY_Y + K_TICK, 0], [x1, SECONDARY_Y, 0], [x2, SECONDARY_Y, 0], [x2, SECONDARY_Y + K_TICK, 0]]}
              color={lineColor} lineWidth={isHov ? 3 : 2.2} transparent opacity={isHov ? 1 : 0.8}
            />
            {period.visible && isInView && (
              <Html position={[midX, SECONDARY_Y - 14, 0]} center zIndexRange={[0, 0]}>
                <div
                  onMouseEnter={() => { if (sortMode === 'historical') setHistoricalDate(period.start); }}
                  onMouseLeave={() => { if (sortMode === 'historical') setHistoricalDate(null); }}
                  style={{
                    color: isHov ? baseColor : '#a0a8c8', fontSize: '10px', fontWeight: 900,
                    letterSpacing: '1px', whiteSpace: 'nowrap', cursor: 'pointer',
                    userSelect: 'none', textTransform: 'uppercase', opacity: isHov ? 1 : 0.45,
                    background: isHov ? 'rgba(255,255,255,0.85)' : 'transparent',
                    padding: isHov ? '2px 6px' : '0', borderRadius: '3px', pointerEvents: 'auto',
                  }}
                >
                  {period.name}
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* Events baseline */}
      {histSecondaryFrise === 'events' && renderEvents.length > 0 && (() => {
        const minX = Math.min(...renderEvents.map(e => e.x)) * sync.zoom - sync.x * sync.zoom;
        const maxX = Math.max(...renderEvents.map(e => e.x)) * sync.zoom - sync.x * sync.zoom;
        return <Line points={[[minX, SECONDARY_Y, 0], [maxX, SECONDARY_Y, 0]]} color="#a0a8c8" lineWidth={1} transparent opacity={0.2} />;
      })()}

      {/* Events */}
      {histSecondaryFrise === 'events' && renderEvents.map((event, i) => {
        const wx = event.x * sync.zoom - sync.x * sync.zoom;
        if (wx < -halfViewport || wx > halfViewport) return null;
        const isHov     = hoveredBookRange ? event.x >= hoveredBookRange.startX && event.x <= hoveredBookRange.endX : false;
        const baseColor = COLOR_BY_EVENT_TYPE[event.type] ?? '#a0a8c8';
        const pinH      = event.priority === 'major' ? PIN_H * 1.6 : event.priority === 'middle' ? PIN_H : PIN_H * 0.6;
        const lw        = isHov ? 2.5 : event.priority === 'major' ? 2.2 : event.priority === 'middle' ? 1.5 : 1;
        const fs        = event.priority === 'major' ? '9px' : event.priority === 'middle' ? '8px' : '7px';
        const op        = isHov ? 1 : event.priority === 'major' ? 0.7 : event.priority === 'middle' ? 0.5 : 0.35;

        return (
          <group key={`event-${i}`}>
            <Line
              points={[[wx, SECONDARY_Y, 0], [wx, SECONDARY_Y + pinH, 0]]}
              color={isHov ? '#C879FF' : '#a0a8c8'} lineWidth={lw} transparent opacity={op}
            />
            {(event.visible || isHov) && (
              <Html position={[wx, SECONDARY_Y - 24 * px, 0]} center zIndexRange={[0, 0]}>
                <div style={{
                  color: isHov ? baseColor : '#a0a8c8', fontSize: fs,
                  fontWeight: event.priority === 'major' ? 800 : 600, letterSpacing: '0.4px',
                  whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none',
                  textTransform: 'uppercase', opacity: op,
                  background: isHov ? 'rgba(247,248,252,0.92)' : 'transparent',
                  padding: isHov ? '0 2px' : '0', borderRadius: '2px',
                }}>
                  {event.name}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
