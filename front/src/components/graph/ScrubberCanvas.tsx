import type { BibleStructureBook } from '@/models/bible';
import type { LayoutResult } from '@/utils/graphLayout';
import { useYearMarkersStore } from '@/store/yearMarkers.store';
import { useGraphModeStore }   from '@/store/graphMode.store';
import { ScrubberMask }  from './ScrubberMask';
import { ScrubberPlane } from './ScrubberPlane';
import { ScrubberSync }  from './ScrubberSync';
import { YearZeroBar }   from './YearZeroBar';

interface Props {
  data:   BibleStructureBook[];
  layout: LayoutResult;
}

/** All scrubber-related R3F elements that live inside the main Canvas. */
export function ScrubberCanvas({ data, layout }: Props) {
  const sortMode       = useGraphModeStore(s => s.sortMode);
  const scrubberWorldX = useYearMarkersStore(s => s.scrubberWorldX);

  return (
    <>
      <ScrubberMask data={data} layout={layout} />
      {sortMode === 'historical' && scrubberWorldX !== null && (
        <>
          <ScrubberPlane worldX={scrubberWorldX} maxY={layout.maxTowerY} />
          <ScrubberSync  worldX={scrubberWorldX} maxTowerY={layout.maxTowerY} />
        </>
      )}
      <YearZeroBar maxY={layout.maxTowerY} />
    </>
  );
}
