import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useYearMarkersStore } from '@/store/yearMarkers.store';
import type { PeriodItem } from './useMarkerData';
import { SmoothHtmlLabel } from './SmoothHtmlLabel';

const SECONDARY_Y = -15;
const K_TICK      = 5;
const MIN_DIST    = 70;

interface Props {
  items:            PeriodItem[];
  px:               number;
  halfViewport:     number;
  hoveredBookRange: { startX: number; endX: number } | null;
}

export function PeriodsFrise({ items, px, halfViewport, hoveredBookRange }: Props) {
  const { size } = useThree();
  const cameraX = useYearMarkersStore(s => s.cameraX);
  const horizontalScale = useYearMarkersStore(s => s.cameraZoom);

  const visibleItems = useMemo(() => {
    if (!items.length) return [];

    // Frustum bounds based on store
    const aspect = size.width / size.height;
    const halfW  = (size.height * aspect) / 2;
    const left   = (cameraX * horizontalScale) - halfW;
    const right  = (cameraX * horizontalScale) + halfW;

    const minDist = MIN_DIST * px;

    const mapped = items.map(item => {
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

    const sorted  = [...mapped].sort((a, b) => (b.endX - b.startX) - (a.endX - a.startX));
    const shownXs: number[] = [];

    for (const p of sorted) {
      if (p.isPartiallyVisible && shownXs.every(sx => Math.abs(p.visibleCx - sx) >= minDist)) {
        p.visible = true;
        shownXs.push(p.visibleCx);
      }
    }
    return mapped;
  }, [items, px, cameraX, horizontalScale, size.width, size.height]);

  if (!items.length) return null;

  return (
    <group>
      {visibleItems.map((period, i) => {
        const x1    = period.sX;
        const x2    = period.eX;
        const isHov = hoveredBookRange
          ? period.startX <= hoveredBookRange.endX && period.endX >= hoveredBookRange.startX
          : false;
        const baseColor = period.type === 'domination' ? '#e8956d'
          : period.type === 'exile' ? '#c0392b' : '#7f8c8d';
        const midX     = period.visibleCx;

        return (
          <group key={`p-${i}`}>
            <Line
              points={[[x1, SECONDARY_Y + K_TICK, 0], [x1, SECONDARY_Y, 0], [x2, SECONDARY_Y, 0], [x2, SECONDARY_Y + K_TICK, 0]]}
              color={isHov ? '#C879FF' : '#a0a8c8'}
              lineWidth={isHov ? 3 : 2.2} transparent opacity={isHov ? 1 : 0.8}
            />
            <SmoothHtmlLabel x={midX} y={SECONDARY_Y - 9} visible={period.visible || isHov}>
              <div
                style={{
                  color: isHov ? baseColor : '#a0a8c8', fontSize: '10px', fontWeight: 900,
                  letterSpacing: '1px', whiteSpace: 'nowrap', cursor: 'pointer',
                  userSelect: 'none', textTransform: 'uppercase',
                  opacity: isHov ? 1 : 0.45,
                  pointerEvents: 'auto',
                  background: isHov ? 'rgba(255,255,255,0.85)' : 'transparent',
                  padding: isHov ? '2px 6px' : '0', borderRadius: '3px',
                }}
              >
                {period.name}
              </div>
            </SmoothHtmlLabel>
          </group>
        );
      })}
    </group>
  );
}
