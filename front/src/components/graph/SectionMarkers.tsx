import { useThree } from '@react-three/fiber';
import type { BibleBookOrder, BibleStructureBook, HistoricalSubMode, BookSortMode } from '@/models/bible';
import type { LayoutResult } from '@/utils/graphLayout.ts';
import { useHistoricalDataStore } from '@/store/historicalData.store';
import { useYearMarkersStore }    from '@/store/yearMarkers.store';
import { useMarkerData } from './useMarkerData';
import { SectionLabels } from './SectionLabels';
import { BooksFrise }   from './BooksFrise';
import { KingsFrise }   from './KingsFrise';
import { PeriodsFrise } from './PeriodsFrise';
import { EventsFrise } from './EventsFrise';

interface Props {
  layout:             LayoutResult;
  hoveredBook:        string | null;
  sortMode:           BookSortMode;
  histSubMode:        HistoricalSubMode;
  histSecondaryFrise: 'kings' | 'periods' | 'events';
  bookOrderData:      BibleBookOrder[] | null;
  sortedData:         BibleStructureBook[] | null;
}

export function SectionMarkers({
  layout, hoveredBook,
  sortMode, histSubMode, histSecondaryFrise,
  bookOrderData, sortedData,
}: Props) {
  const { viewport, size } = useThree();

  const { kingsData: kings, periodsData: periods, eventsData: events } = useHistoricalDataStore();

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
      <BooksFrise
        layout={layout}
        px={px}
        hoveredBook={hoveredBook}
      />
      <SectionLabels
        classicSections={classicSections}
        sizeItems={sizeItems}
        timelineItems={timelineItems}
        sortMode={sortMode}
        px={px} halfViewport={halfViewport}
        hoveredBook={hoveredBook}
      />
      {histSecondaryFrise === 'kings' && (
        <KingsFrise
          items={kingItems}
          px={px} halfViewport={halfViewport}
          hoveredBookRange={hoveredBookRange}
        />
      )}
      {histSecondaryFrise === 'periods' && (
        <PeriodsFrise
          items={periodItems}
          px={px} halfViewport={halfViewport}
          hoveredBookRange={hoveredBookRange}
        />
      )}
      {histSecondaryFrise === 'events' && (
        <EventsFrise
          items={eventItems}
          px={px} halfViewport={halfViewport}
          hoveredBookRange={hoveredBookRange}
        />
      )}
    </group>
  );
}
