import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useYearMarkersStore } from '@/store/yearMarkers.store';
import type { BookSortMode } from '@/models/bible';
import type { ClassicSection, LabelItem } from './useMarkerData';
import { SmoothHtmlLabel } from './SmoothHtmlLabel';

const BY     = 15;
const TICK   = 4;
const LABEL_Y = 5;
const MIN_DIST = 90;

interface Props {
  classicSections: ClassicSection[];
  sizeItems:       LabelItem[];
  timelineItems:   LabelItem[];
  sortMode:        BookSortMode;
  px:              number;
  halfViewport:    number;
  hoveredBook:     string | null;
}

export function SectionLabels({
  classicSections, sizeItems, timelineItems,
  sortMode, px, halfViewport,
  hoveredBook,
}: Props) {
  const { size } = useThree();
  const cameraX = useYearMarkersStore(s => s.cameraX);
  const horizontalScale = useYearMarkersStore(s => s.cameraZoom);
  const rawItems = sortMode === 'historical' ? timelineItems : sortMode === 'size' ? sizeItems : classicSections;

  const renderItems = useMemo(() => {
    // Frustum bounds based on store (avoids 1-frame jitter from camera.position.x)
    const aspect = size.width / size.height;
    const halfW  = (size.height * aspect) / 2;
    const left   = (cameraX * horizontalScale) - halfW;
    const right  = (cameraX * horizontalScale) + halfW;

    const minDist = MIN_DIST * px;
    
    // Map items to include visible center
    const items = rawItems.map(item => {
      const sX = item.startX * horizontalScale;
      const eX = item.endX   * horizontalScale;

      const vStart = Math.max(sX, left);
      const vEnd   = Math.min(eX, right);
      const isPartiallyVisible = vStart < vEnd;
      const visibleCx = isPartiallyVisible ? (vStart + vEnd) / 2 : (sX + eX) / 2;

      return {
        ...item,
        sX, eX,
        visibleCx,
        isPartiallyVisible,
        visible: false,
      };
    });

    if (sortMode === 'classic') return items.map(item => ({ ...item, visible: true }));

    const byPriority = [...items].sort((a, b) => ((b as LabelItem).priority ?? 0) - ((a as LabelItem).priority ?? 0));
    const shownXs: number[] = [];

    for (const item of byPriority) {
      if (item.isPartiallyVisible && shownXs.every(sx => Math.abs(item.visibleCx - sx) >= minDist)) {
        item.visible = true;
        shownXs.push(item.visibleCx);
      }
    }
    return items;
  }, [rawItems, sortMode, px, cameraX, horizontalScale, size.width, size.height]);

  return (
    <group>
      {renderItems.map((section, i) => {
        const isHovered  = section.books.includes(hoveredBook ?? '');
        const color      = isHovered ? '#826AED' : '#a0a8c8';
        const worldStart = section.sX;
        const worldEnd   = section.eX;
        const centerX    = section.visibleCx;
        const name       = (section as ClassicSection).name ?? (section as LabelItem).label;

        return (
          <group key={i}>
            <Line
              points={[[worldStart, BY + TICK, 0], [worldStart, BY, 0], [worldEnd, BY, 0], [worldEnd, BY + TICK, 0]]}
              color={color} lineWidth={isHovered ? 2.5 : 1.2} transparent opacity={0.4}
            />
            <SmoothHtmlLabel x={centerX} y={LABEL_Y} visible={section.visible}>
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
            </SmoothHtmlLabel>
          </group>
        );
      })}
    </group>
  );
}
