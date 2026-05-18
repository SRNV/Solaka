import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import type { KingItem } from './useMarkerData';

const SECONDARY_Y = 12;
const K_TICK      = 5;
const MIN_DIST    = 70;

interface Props {
  items:            KingItem[];
  sync:             { x: number; zoom: number };
  px:               number;
  halfViewport:     number;
  hoveredBookRange: { startX: number; endX: number } | null;
}

export function KingsFrise({ items, sync, px, halfViewport, hoveredBookRange }: Props) {
  const { visibleNames, baseline } = useMemo(() => {
    if (!items.length) return { visibleNames: new Set<string>(), baseline: null };
    const sorted  = [...items].sort((a, b) => b.priority - a.priority);
    const visible = new Set<string>();
    const shownXs: number[] = [];
    const minDist = MIN_DIST * px;
    for (const k of sorted) {
      const midX = ((k.startX + k.endX) / 2) * sync.zoom - sync.x * sync.zoom;
      if (shownXs.every(sx => Math.abs(midX - sx) >= minDist)) {
        visible.add(k.name);
        shownXs.push(midX);
      }
    }
    const minX = Math.min(...items.map(k => k.startX));
    const maxX = Math.max(...items.map(k => k.endX));
    return { visibleNames: visible, baseline: { x1: minX, x2: maxX } };
  }, [items, sync.zoom, sync.x, px]);

  if (!items.length) return null;

  return (
    <group>
      {baseline && (
        <Line
          points={[
            [baseline.x1 * sync.zoom - sync.x * sync.zoom, SECONDARY_Y, 0],
            [baseline.x2 * sync.zoom - sync.x * sync.zoom, SECONDARY_Y, 0],
          ]}
          color="#a0a8c8" lineWidth={1.2} transparent opacity={0.15}
        />
      )}
      {items.map((king, i) => {
        const x1    = king.startX * sync.zoom - sync.x * sync.zoom;
        const x2    = king.endX   * sync.zoom - sync.x * sync.zoom;
        const isHov = hoveredBookRange
          ? king.startX <= hoveredBookRange.endX && king.endX >= hoveredBookRange.startX
          : false;
        const baseColor = king.saint ? '#4caf50'
          : (king.kingdom.judah && king.kingdom.israel) ? '#826AED'
          : king.kingdom.judah ? '#e8956d' : '#85c1e9';
        const isInView = x1 <= halfViewport && x2 >= -halfViewport;
        const midX     = (Math.max(x1, -halfViewport) + Math.min(x2, halfViewport)) / 2;

        return (
          <group key={`k-${i}`}>
            <Line
              points={[[x1, SECONDARY_Y + K_TICK, 0], [x1, SECONDARY_Y, 0], [x2, SECONDARY_Y, 0], [x2, SECONDARY_Y + K_TICK, 0]]}
              color={isHov ? '#C879FF' : '#a0a8c8'}
              lineWidth={isHov ? 2.5 : 1.2} transparent opacity={isHov ? 1 : 0.4}
            />
            {visibleNames.has(king.name) && isInView && (
              <Html position={[midX, SECONDARY_Y - 12 * px, 0]} center>
                <div
                  style={{
                    color: isHov ? baseColor : '#a0a8c8', fontSize: '9px', fontWeight: 900,
                    letterSpacing: '1px', whiteSpace: 'nowrap', cursor: 'pointer',
                    userSelect: 'none', textTransform: 'uppercase',
                    opacity: isHov ? 1 : 0.45, pointerEvents: 'auto',
                  }}
                >
                  {king.name}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
