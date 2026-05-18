import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useYearMarkersStore } from '@/store/yearMarkers.store';
import { COLOR_BY_EVENT_TYPE } from './friseUtils';
import type { EventItem } from './useMarkerData';
import { SmoothHtmlLabel } from './SmoothHtmlLabel';

const SECONDARY_Y = -15;
const PIN_H       = 8;
const MIN_DIST    = 36;

interface Props {
  items:            EventItem[];
  px:               number;
  halfViewport:     number;
  hoveredBookRange: { startX: number; endX: number } | null;
}

export function EventsFrise({ items, px, halfViewport, hoveredBookRange }: Props) {
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

    const minDist  = MIN_DIST * px;

    const mapped = items.map(e => {
      const scaledX = e.x * horizontalScale;
      const isVisibleInFrustum = scaledX >= left && scaledX <= right;
      return {
        ...e,
        scaledX,
        isVisibleInFrustum,
        visible: false,
      };
    });

    const sorted   = [...mapped].sort((a, b) => {
      const order = { major: 3, middle: 2, minor: 1 } as Record<string, number>;
      return (order[b.priority] ?? 0) - (order[a.priority] ?? 0);
    });
    
    const shownXs: number[] = [];
    for (const e of sorted) {
      if (e.isVisibleInFrustum && (shownXs.length < 3 || shownXs.every(sx => Math.abs(e.scaledX - sx) >= minDist))) {
        e.visible = true;
        shownXs.push(e.scaledX);
      }
    }
    return mapped;
  }, [items, px, cameraX, horizontalScale, size.width, size.height]);

  if (!items.length) return null;

  const minX = Math.min(...visibleItems.map(e => e.scaledX));
  const maxX = Math.max(...visibleItems.map(e => e.scaledX));

  return (
    <group>
      <Line
        points={[[minX, SECONDARY_Y, 0], [maxX, SECONDARY_Y, 0]]}
        color="#a0a8c8" lineWidth={1} transparent opacity={0.2}
      />
      {visibleItems.map((event, i) => {
        const wx = event.scaledX;

        const isHov     = hoveredBookRange
          ? (event.x * horizontalScale) >= (hoveredBookRange.startX * horizontalScale) && (event.x * horizontalScale) <= (hoveredBookRange.endX * horizontalScale)
          : false;
        const baseColor = COLOR_BY_EVENT_TYPE[event.type] ?? '#a0a8c8';
        const pinH      = event.priority === 'major' ? PIN_H * 1.6 : event.priority === 'middle' ? PIN_H : PIN_H * 0.6;
        const lw        = isHov ? 2.5 : event.priority === 'major' ? 2.2 : event.priority === 'middle' ? 1.5 : 1;
        const fs        = event.priority === 'major' ? '9px' : event.priority === 'middle' ? '8px' : '7px';
        const op        = isHov ? 1 : event.priority === 'major' ? 0.7 : event.priority === 'middle' ? 0.5 : 0.35;
        const isVisible = event.visible;

        return (
          <group key={`ev-${i}`}>
            <Line
              points={[[wx, SECONDARY_Y, 0], [wx, SECONDARY_Y + pinH, 0]]}
              color={isHov ? '#C879FF' : '#a0a8c8'} lineWidth={lw} transparent opacity={op}
            />
            <SmoothHtmlLabel x={wx} y={SECONDARY_Y - 12 * px} visible={isVisible || isHov}>
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
            </SmoothHtmlLabel>
          </group>
        );
      })}
    </group>
  );
}
