import { useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { BibleBookOrder, BibleEvent, BibleStructureBook, HistoricalPeriod, HistoricalSubMode, King, BookSortMode } from '@/models/bible';
import type { BibleTarget } from '@/contexts/BibleDrawerContext.tsx';
import type { LayoutResult } from '@/utils/graphLayout.ts';
import { useMarkerData } from './useMarkerData';
import { SectionLabels } from './SectionLabels';
import { KingsFrise } from './KingsFrise';
import { PeriodsFrise } from './PeriodsFrise';
import { EventsFrise } from './EventsFrise';

interface Props {
  layout:             LayoutResult;
  hoveredBook:        string | null;
  mainCamRef:         React.MutableRefObject<{ x: number; zoom: number }>;
  sortMode:           BookSortMode;
  histSubMode:        HistoricalSubMode;
  histSecondaryFrise: 'kings' | 'periods' | 'events';
  bookOrderData:      BibleBookOrder[] | null;
  sortedData:         BibleStructureBook[] | null;
  kings:              King[] | null;
  periods:            HistoricalPeriod[] | null;
  events:             BibleEvent[] | null;
  target:             BibleTarget | null;
}

export function SectionMarkers({
  layout, hoveredBook, mainCamRef,
  sortMode, histSubMode, histSecondaryFrise,
  bookOrderData, sortedData, kings, periods, events,
}: Props) {
  const { viewport, size } = useThree();
  const [sync, setSync]    = useState(() => ({ x: mainCamRef.current.x, zoom: mainCamRef.current.zoom }));

  useFrame(() => {
    const { x, zoom } = mainCamRef.current;
    if (x !== sync.x || zoom !== sync.zoom) setSync({ x, zoom });
  });

  const { classicSections, sizeItems, timelineItems, kingItems, periodItems, eventItems } = useMarkerData({
    sortMode, histSubMode, layout, bookOrderData, sortedData, kings, periods, events,
  });

  const px           = viewport.height / size.height;
  const halfViewport = viewport.width / 2;
  const hoveredBookRange = hoveredBook
    ? layout.bookLabels.find(b => b.name === hoveredBook) ?? null
    : null;

  return (
    <group>
      <SectionLabels
        classicSections={classicSections}
        sizeItems={sizeItems}
        timelineItems={timelineItems}
        sortMode={sortMode}
        sync={sync} px={px} halfViewport={halfViewport}
        hoveredBook={hoveredBook}
      />
      {histSecondaryFrise === 'kings' && (
        <KingsFrise
          items={kingItems}
          sync={sync} px={px} halfViewport={halfViewport}
          hoveredBookRange={hoveredBookRange}
        />
      )}
      {histSecondaryFrise === 'periods' && (
        <PeriodsFrise
          items={periodItems}
          sync={sync} px={px} halfViewport={halfViewport}
          hoveredBookRange={hoveredBookRange}
        />
      )}
      {histSecondaryFrise === 'events' && (
        <EventsFrise
          items={eventItems}
          sync={sync} px={px} halfViewport={halfViewport}
          hoveredBookRange={hoveredBookRange}
        />
      )}
    </group>
  );
}
