import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import { COLOR_BY_EVENT_TYPE } from './friseUtils';
import type { EventItem } from './useMarkerData';

const SECONDARY_Y = 30;
const PIN_H       = 14;
const MIN_DIST    = 40;

interface Props {
  items:            EventItem[];
  sync:             { x: number; zoom: number };
  px:               number;
  halfViewport:     number;
  hoveredBookRange: { startX: number; endX: number } | null;
}

export function EventsFrise({ items, sync, px, halfViewport, hoveredBookRange }: Props) {
  const visibleWithHov = useMemo(() => {
    if (!items.length) return new Map<string, boolean>();
    const minDist  = MIN_DIST * px;
    const sorted   = [...items].sort((a, b) => {
      const order = { major: 3, middle: 2, minor: 1 } as Record<string, number>;
      return (order[b.priority] ?? 0) - (order[a.priority] ?? 0);
    });
    const shownXs: number[] = [];
    const result  = new Map<string, boolean>();
    for (const e of items) {
      const screenX = e.x * sync.zoom - sync.x * sync.zoom;
      const rank    = sorted.indexOf(e);
      const show    = rank < 3 || shownXs.every(sx => Math.abs(screenX - sx) >= minDist);
      result.set(e.name + e.year, show);
      if (show) shownXs.push(screenX);
    }
    return result;
  }, [items, sync.zoom, sync.x, px]);

  if (!items.length) return null;

  const minX = Math.min(...items.map(e => e.x)) * sync.zoom - sync.x * sync.zoom;
  const maxX = Math.max(...items.map(e => e.x)) * sync.zoom - sync.x * sync.zoom;

  return (
    <group>
      <Line
        points={[[minX, SECONDARY_Y, 0], [maxX, SECONDARY_Y, 0]]}
        color="#a0a8c8" lineWidth={1} transparent opacity={0.2}
      />
      {items.map((event, i) => {
        const wx = event.x * sync.zoom - sync.x * sync.zoom;
        if (wx < -halfViewport || wx > halfViewport) return null;

        const isHov     = hoveredBookRange
          ? event.x >= hoveredBookRange.startX && event.x <= hoveredBookRange.endX
          : false;
        const baseColor = COLOR_BY_EVENT_TYPE[event.type] ?? '#a0a8c8';
        const pinH      = event.priority === 'major' ? PIN_H * 1.6 : event.priority === 'middle' ? PIN_H : PIN_H * 0.6;
        const lw        = isHov ? 2.5 : event.priority === 'major' ? 2.2 : event.priority === 'middle' ? 1.5 : 1;
        const fs        = event.priority === 'major' ? '9px' : event.priority === 'middle' ? '8px' : '7px';
        const op        = isHov ? 1 : event.priority === 'major' ? 0.7 : event.priority === 'middle' ? 0.5 : 0.35;
        const isVisible = visibleWithHov.get(event.name + event.year) ?? false;

        return (
          <group key={`ev-${i}`}>
            <Line
              points={[[wx, SECONDARY_Y, 0], [wx, SECONDARY_Y + pinH, 0]]}
              color={isHov ? '#C879FF' : '#a0a8c8'} lineWidth={lw} transparent opacity={op}
            />
            {(isVisible || isHov) && (
              <Html position={[wx, SECONDARY_Y - 24 * px, 0]} center zIndexRange={[0, 0]}>
                <div style={{
                  color: isHov ? baseColor : '#a0a8c8', fontSize: fs,
                  fontWeight: event.priority === 'major' ? 800 : 600, letterSpacing: '0.4px',
                  whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none',
                  textTransform: 'uppercase', opacity: op,
                  background: isHov ? 'rgba(247,248,252,0.92)' : 'transparent',
                  padding: isHov ? '0 2px' : '0', borderRadius: '2px',
                }}>
                  {event.name}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
