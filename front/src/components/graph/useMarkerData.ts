import { useMemo } from 'react';
import type { BibleBookOrder, BibleEvent, BibleStructureBook, HistoricalPeriod, HistoricalSubMode, King, BookSortMode } from '@/models/bible';
import type { LayoutResult } from '@/utils/graphLayout.ts';
import { buildYearPoints, yearToWorldX } from './friseUtils';

export interface ClassicSection {
  name:   string;
  startX: number;
  endX:   number;
  books:  string[];
}

export interface LabelItem {
  label:    string;
  x:        number;
  startX:   number;
  endX:     number;
  books:    string[];
  priority: number;
}

export interface KingItem extends King {
  startX:   number;
  endX:     number;
  priority: number;
}

export interface PeriodItem extends HistoricalPeriod {
  startX: number;
  endX:   number;
}

export interface EventItem extends BibleEvent {
  x: number;
}

export interface MarkerData {
  classicSections: ClassicSection[];
  sizeItems:       LabelItem[];
  timelineItems:   LabelItem[];
  yearPoints:      { year: number; x: number }[];
  kingItems:       KingItem[];
  periodItems:     PeriodItem[];
  eventItems:      EventItem[];
}

interface Input {
  sortMode:     BookSortMode;
  histSubMode:  HistoricalSubMode;
  layout:       LayoutResult;
  bookOrderData: BibleBookOrder[] | null;
  sortedData:   BibleStructureBook[] | null;
  kings:        King[] | null;
  periods:      HistoricalPeriod[] | null;
  events:       BibleEvent[] | null;
}

export function useMarkerData({
  sortMode, histSubMode, layout, bookOrderData, sortedData, kings, periods, events,
}: Input): MarkerData {

  const classicSections = useMemo<ClassicSection[]>(() => {
    if (sortMode !== 'classic' || !layout.bookLabels.length) return [];
    const groups: ClassicSection[] = [];
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

  const sizeItems = useMemo<LabelItem[]>(() => {
    if (sortMode !== 'size' || !layout.bookLabels.length) return [];
    const items: LabelItem[] = [];
    let current: Omit<LabelItem, 'x'> | null = null;
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

  const timelineItems = useMemo<LabelItem[]>(() => {
    if (sortMode !== 'historical' || !bookOrderData || !layout.bookLabels.length) return [];
    const dateMap = new Map(bookOrderData.map(b => [b.number, b[histSubMode]]));
    const items: LabelItem[] = [];
    let current: Omit<LabelItem, 'x'> | null = null;

    const fmtYear = (y: number) => {
      const abs = Math.abs(y);
      return y === 0 ? '0' : y < 0 ? `${abs} av. J.-C.` : `${abs} ap. J.-C.`;
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

  const yearPoints = useMemo(() => {
    if (sortMode !== 'historical' || !bookOrderData || !layout.bookLabels.length) return [];
    return buildYearPoints(bookOrderData, layout.bookLabels, histSubMode);
  }, [sortMode, bookOrderData, layout.bookLabels, histSubMode]);

  const kingItems = useMemo<KingItem[]>(() => {
    if (sortMode !== 'historical' || !kings || !yearPoints.length) return [];
    return kings.map(k => ({
      ...k,
      startX:   yearToWorldX(k.reign.start, yearPoints),
      endX:     k.reign.end === null ? layout.totalX : yearToWorldX(k.reign.end, yearPoints),
      priority: k.saint ? 3 : (k.kingdom.israel && k.kingdom.judah) ? 2 : 1,
    }));
  }, [sortMode, kings, yearPoints, layout.totalX]);

  const periodItems = useMemo<PeriodItem[]>(() => {
    if (sortMode !== 'historical' || !periods || !yearPoints.length) return [];
    return periods.map(p => ({
      ...p,
      startX: yearToWorldX(p.start, yearPoints),
      endX:   yearToWorldX(p.end, yearPoints),
    }));
  }, [sortMode, periods, yearPoints]);

  const eventItems = useMemo<EventItem[]>(() => {
    if (sortMode !== 'historical' || !events || !yearPoints.length) return [];
    return events.map(e => ({ ...e, x: yearToWorldX(e.year, yearPoints) }));
  }, [sortMode, events, yearPoints]);

  return { classicSections, sizeItems, timelineItems, yearPoints, kingItems, periodItems, eventItems };
}
