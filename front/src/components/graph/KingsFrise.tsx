import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useYearMarkersStore } from '@/store/yearMarkers.store';
import type { KingItem } from './useMarkerData';
import { SmoothHtmlLabel } from './SmoothHtmlLabel';

const Y_JUDAH   = -12;
const Y_ISRAEL  = -24;
const K_TICK    = 5;
const MIN_DIST  = 70;

interface Props {
  items:            KingItem[];
  px:               number;
  halfViewport:     number;
  hoveredBookRange: { startX: number; endX: number } | null;
}

export function KingsFrise({ items, px, halfViewport, hoveredBookRange }: Props) {
  const { size } = useThree();
  const cameraX = useYearMarkersStore(s => s.cameraX);
  const horizontalScale = useYearMarkersStore(s => s.cameraZoom);

  const { visibleItems, baseline } = useMemo(() => {
    if (!items.length) return { visibleItems: [], baseline: null };

    // Frustum bounds based on store
    const aspect = size.width / size.height;
    const halfW  = (size.height * aspect) / 2;
    const left   = (cameraX * horizontalScale) - halfW;
    const right  = (cameraX * horizontalScale) + halfW;

    const minDist = MIN_DIST * px;
    
    // Map items to include visible center
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

    const sorted  = [...mapped].sort((a, b) => b.priority - a.priority);
    const shownXs: number[] = [];
    
    for (const k of sorted) {
      if (k.isPartiallyVisible && shownXs.every(sx => Math.abs(k.visibleCx - sx) >= minDist)) {
        k.visible = true;
        shownXs.push(k.visibleCx);
      }
    }
    const minX = Math.min(...mapped.map(k => k.sX));
    const maxX = Math.max(...mapped.map(k => k.eX));
    return { visibleItems: mapped, baseline: { x1: minX, x2: maxX } };
  }, [items, px, cameraX, horizontalScale, size.width, size.height]);

  if (!items.length) return null;

  return (
    <group>
      {baseline && (
        <>
          <Line
            points={[
              [baseline.x1, Y_JUDAH, 0],
              [baseline.x2, Y_JUDAH, 0],
            ]}
            color="#a0a8c8" lineWidth={1.2} transparent opacity={0.15}
          />
          <Line
            points={[
              [baseline.x1, Y_ISRAEL, 0],
              [baseline.x2, Y_ISRAEL, 0],
            ]}
            color="#a0a8c8" lineWidth={1.2} transparent opacity={0.15}
          />
        </>
      )}
      {visibleItems.map((king, i) => {
        const x1    = king.sX;
        const x2    = king.eX;
        const isHov = hoveredBookRange
          ? king.startX <= hoveredBookRange.endX && king.endX >= hoveredBookRange.startX
          : false;
        const baseColor = king.saint ? '#4caf50'
          : (king.kingdom.judah && king.kingdom.israel) ? '#826AED'
          : king.kingdom.judah ? '#e8956d' : '#85c1e9';
        const midX     = king.visibleCx;
        const kingY    = (king.kingdom.israel && !king.kingdom.judah) ? Y_ISRAEL : Y_JUDAH;

        return (
          <group key={`k-${i}`}>
            <Line
              points={[[x1, kingY + K_TICK, 0], [x1, kingY, 0], [x2, kingY, 0], [x2, kingY + K_TICK, 0]]}
              color={isHov ? '#C879FF' : '#a0a8c8'}
              lineWidth={isHov ? 2.5 : 1.2} transparent opacity={isHov ? 1 : 0.4}
            />
            <SmoothHtmlLabel x={midX} y={kingY - 12 * px} visible={king.visible || isHov}>
              <div
                style={{
                  color: isHov ? baseColor : '#a0a8c8', fontSize: '9px', fontWeight: 900,
                  letterSpacing: '1px', whiteSpace: 'nowrap', cursor: 'pointer',
                  userSelect: 'none', textTransform: 'uppercase',
                  opacity: isHov ? 1 : 0.45,
                  pointerEvents: 'auto',
                }}
              >
                {king.name}
              </div>
            </SmoothHtmlLabel>
          </group>
        );
      })}
    </group>
  );
}
