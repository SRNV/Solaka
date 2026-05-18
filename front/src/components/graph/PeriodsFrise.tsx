import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import type { PeriodItem } from './useMarkerData';

const SECONDARY_Y = 30;
const K_TICK      = 8;
const MIN_DIST    = 80;

interface Props {
  items:            PeriodItem[];
  sync:             { x: number; zoom: number };
  px:               number;
  halfViewport:     number;
  hoveredBookRange: { startX: number; endX: number } | null;
}

export function PeriodsFrise({ items, sync, px, halfViewport, hoveredBookRange }: Props) {
  const visibleNames = useMemo(() => {
    if (!items.length) return new Set<string>();
    const sorted  = [...items].sort((a, b) => (b.endX - b.startX) - (a.endX - a.startX));
    const visible = new Set<string>();
    const shownXs: number[] = [];
    const minDist = MIN_DIST * px;
    for (const p of sorted) {
      const midX = ((p.startX + p.endX) / 2) * sync.zoom - sync.x * sync.zoom;
      if (shownXs.every(sx => Math.abs(midX - sx) >= minDist)) {
        visible.add(p.name);
        shownXs.push(midX);
      }
    }
    return visible;
  }, [items, sync.zoom, sync.x, px]);

  if (!items.length) return null;

  return (
    <group>
      {items.map((period, i) => {
        const x1    = period.startX * sync.zoom - sync.x * sync.zoom;
        const x2    = period.endX   * sync.zoom - sync.x * sync.zoom;
        const isHov = hoveredBookRange
          ? period.startX <= hoveredBookRange.endX && period.endX >= hoveredBookRange.startX
          : false;
        const baseColor = period.type === 'domination' ? '#e8956d'
          : period.type === 'exile' ? '#c0392b' : '#7f8c8d';
        const isInView = x1 <= halfViewport && x2 >= -halfViewport;
        const midX     = (Math.max(x1, -halfViewport) + Math.min(x2, halfViewport)) / 2;

        return (
          <group key={`p-${i}`}>
            <Line
              points={[[x1, SECONDARY_Y + K_TICK, 0], [x1, SECONDARY_Y, 0], [x2, SECONDARY_Y, 0], [x2, SECONDARY_Y + K_TICK, 0]]}
              color={isHov ? '#C879FF' : '#a0a8c8'}
              lineWidth={isHov ? 3 : 2.2} transparent opacity={isHov ? 1 : 0.8}
            />
            {visibleNames.has(period.name) && isInView && (
              <Html position={[midX, SECONDARY_Y - 14, 0]} center zIndexRange={[0, 0]}>
                <div
                  style={{
                    color: isHov ? baseColor : '#a0a8c8', fontSize: '10px', fontWeight: 900,
                    letterSpacing: '1px', whiteSpace: 'nowrap', cursor: 'pointer',
                    userSelect: 'none', textTransform: 'uppercase',
                    opacity: isHov ? 1 : 0.45, pointerEvents: 'auto',
                    background: isHov ? 'rgba(255,255,255,0.85)' : 'transparent',
                    padding: isHov ? '2px 6px' : '0', borderRadius: '3px',
                  }}
                >
                  {period.name}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
