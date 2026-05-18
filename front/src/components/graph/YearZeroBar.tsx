import { useYearMarkersStore } from '@/store/yearMarkers.store';
import { useGraphModeStore }   from '@/store/graphMode.store';
import { ScrubberPlane }       from './ScrubberPlane';

interface Props { maxY: number }

/** Permanent golden bar at year 0, visible whenever books are sorted historically. */
export function YearZeroBar({ maxY }: Props) {
  const sortMode   = useGraphModeStore(s => s.sortMode);
  const year0WorldX = useYearMarkersStore(s => s.year0WorldX);

  if (sortMode !== 'historical' || year0WorldX === null) return null;

  return <ScrubberPlane worldX={year0WorldX} maxY={maxY} color="#D4AC0D" opacity={0.8} width={0.5} />;
}
