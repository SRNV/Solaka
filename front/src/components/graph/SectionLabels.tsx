import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import type { BookSortMode } from '@/models/bible';
import type { ClassicSection, LabelItem } from './useMarkerData';

const BY     = 46;
const TICK   = 4;
const LABEL_Y = 24;
const MIN_DIST = 90;

interface Props {
  classicSections: ClassicSection[];
  sizeItems:       LabelItem[];
  timelineItems:   LabelItem[];
  sortMode:        BookSortMode;
  sync:            { x: number; zoom: number };
  px:              number;
  halfViewport:    number;
  hoveredBook:     string | null;
}

export function SectionLabels({
  classicSections, sizeItems, timelineItems,
  sortMode, sync, px, halfViewport,
  hoveredBook,
}: Props) {
  const rawItems = sortMode === 'historical' ? timelineItems : sortMode === 'size' ? sizeItems : classicSections;

  const renderItems = useMemo(() => {
    if (sortMode === 'classic') return rawItems.map(item => ({ ...item, visible: true }));

    const minDist = MIN_DIST * px;
    const byPriority = [...rawItems].sort((a, b) => ((b as LabelItem).priority ?? 0) - ((a as LabelItem).priority ?? 0));
    const result = rawItems.map(item => ({ ...item, visible: false }));
    const shownXs: number[] = [];

    if (result.length > 0) {
      result[0].visible = true;
      shownXs.push((result[0].startX + result[0].endX) / 2 * sync.zoom - sync.x * sync.zoom);
      if (result.length > 1) {
        const last = result[result.length - 1];
        last.visible = true;
        shownXs.push((last.startX + last.endX) / 2 * sync.zoom - sync.x * sync.zoom);
      }
    }

    for (const item of byPriority) {
      const screenX = ((item.startX + item.endX) / 2) * sync.zoom - sync.x * sync.zoom;
      if (shownXs.every(sx => Math.abs(screenX - sx) >= minDist)) {
        const idx = result.findIndex(r => r.startX === item.startX && r.endX === item.endX);
        if (idx >= 0) result[idx].visible = true;
        shownXs.push(screenX);
      }
    }
    return result;
  }, [rawItems, sortMode, sync.zoom, sync.x, px]);

  return (
    <group>
      {renderItems.map((section, i) => {
        const isHovered  = section.books.includes(hoveredBook ?? '');
        const color      = isHovered ? '#826AED' : '#a0a8c8';
        const worldStart = section.startX * sync.zoom - sync.x * sync.zoom;
        const worldEnd   = section.endX   * sync.zoom - sync.x * sync.zoom;
        const isInView   = worldStart <= halfViewport && worldEnd >= -halfViewport;
        const centerX    = (Math.max(worldStart, -halfViewport) + Math.min(worldEnd, halfViewport)) / 2;
        const name       = (section as ClassicSection).name ?? (section as LabelItem).label;

        return (
          <group key={i}>
            <Line
              points={[[worldStart, BY + TICK, 0], [worldStart, BY, 0], [worldEnd, BY, 0], [worldEnd, BY + TICK, 0]]}
              color={color} lineWidth={isHovered ? 2.5 : 1.2} transparent opacity={0.4}
            />
            {isInView && section.visible && (
              <Html position={[centerX, LABEL_Y, 0]} center zIndexRange={[0, 0]}>
                <div
                  style={{
                    color, fontSize: '9px', fontWeight: 900, letterSpacing: '1px',
                    whiteSpace: 'nowrap', opacity: 0.75,
                    cursor: 'default',
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
    </group>
  );
}
