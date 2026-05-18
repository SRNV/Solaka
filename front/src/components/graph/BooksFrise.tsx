import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useYearMarkersStore } from '@/store/yearMarkers.store';
import type { LayoutResult, BookLabel } from '@/utils/graphLayout.ts';
import { SmoothHtmlLabel } from './SmoothHtmlLabel';

const LABEL_Y = 32;
const BRACE_Y = 44;
const BRACE_TICK_H = 15;
const MIN_DIST = 40;
const GOSPEL_BOOKS = new Set(['Matthieu', 'Marc', 'Luc', 'Jean']);

interface Props {
  layout:       LayoutResult;
  px:           number;
  hoveredBook:  string | null;
}

function BookBrace({ label, hoveredBook, horizontalScale }: { label: BookLabel, hoveredBook: string | null, horizontalScale: number }) {
  const color     = label.name === hoveredBook ? '#F9DC5C' : '#a0a8c8';
  const lineWidth = label.name === hoveredBook ? 3 : 1.2;
  const halfSpan  = ((label.endX - label.startX) / 2) * horizontalScale;
  const cx        = label.cx * horizontalScale;

  return (
    <group position={[cx, 0, 0]}>
      {label.endX <= label.startX ? (
        <Line points={[[0, BRACE_Y + BRACE_TICK_H, 0], [0, BRACE_Y, 0]]} color={color} lineWidth={lineWidth} transparent opacity={0.4} />
      ) : (
        <Line
          points={[
            [-halfSpan, BRACE_Y + BRACE_TICK_H, 0],
            [-halfSpan, BRACE_Y, 0],
            [ halfSpan, BRACE_Y, 0],
            [ halfSpan, BRACE_Y + BRACE_TICK_H, 0],
          ]}
          color={color}
          lineWidth={lineWidth}
          transparent opacity={0.4}
        />
      )}
    </group>
  );
}

export function BooksFrise({ layout, px, hoveredBook }: Props) {
  const { size } = useThree();
  const cameraX = useYearMarkersStore(s => s.cameraX);
  const horizontalScale = useYearMarkersStore(s => s.cameraZoom);

  const renderItems = useMemo(() => {
    // Frustum bounds based on store
    const aspect = size.width / size.height;
    const halfW  = (size.height * aspect) / 2;
    const left   = (cameraX * horizontalScale) - halfW;
    const right  = (cameraX * horizontalScale) + halfW;

    const minDist = MIN_DIST * px;
    const items = layout.bookLabels.map(label => {
      const isGospel = GOSPEL_BOOKS.has(label.name);
      const width    = label.endX - label.startX;
      
      const sX = label.startX * horizontalScale;
      const eX = label.endX   * horizontalScale;
      const cX = label.cx     * horizontalScale;

      const visibleStart = Math.max(sX, left);
      const visibleEnd   = Math.min(eX, right);
      const isPartiallyVisible = visibleStart < visibleEnd;
      const visibleCx = isPartiallyVisible ? (visibleStart + visibleEnd) / 2 : cX;

      return {
        ...label,
        isGospel,
        priority: isGospel ? 999999 : width,
        visibleCx,
        isPartiallyVisible,
        visible: false,
      };
    });

    const byPriority = [...items].sort((a, b) => b.priority - a.priority);
    const shownXs: number[] = [];

    for (const item of byPriority) {
      if (!item.isPartiallyVisible) continue;
      if (item.isGospel || shownXs.every(sx => Math.abs(item.visibleCx - sx) >= minDist)) {
        item.visible = true;
        shownXs.push(item.visibleCx);
      }
    }

    return items;
  }, [layout.bookLabels, px, cameraX, horizontalScale, size.width, size.height]);

  return (
    <group>
      {/* Book span braces */}
      {layout.bookLabels.map(label => (
        <BookBrace
          key={`brace_${label.name}`}
          label={label}
          hoveredBook={hoveredBook}
          horizontalScale={horizontalScale}
        />
      ))}

      {renderItems.map((book) => {
        const isHovered = hoveredBook === book.name;

        const labelStyle: React.CSSProperties = {
          pointerEvents: 'none',
          whiteSpace:    'nowrap',
          fontSize:      '10px',
          fontWeight:    700,
          letterSpacing: '0.3px',
          userSelect:    'none',
          textTransform: 'uppercase',
          color:         isHovered ? '#F9DC5C' : '#a0a8c8',
        };

        if (book.isGospel) {
          Object.assign(labelStyle, {
            background:   isHovered ? '#F9DC5C' : 'var(--secondary)',
            color:        isHovered ? '#000'    : '#fff',
            padding:      '2px 7px',
            borderRadius: '4px',
            fontSize:     '11px',
          });
        }

        return (
          <SmoothHtmlLabel 
            key={book.name} 
            x={book.visibleCx} 
            y={LABEL_Y} 
            visible={book.visible || isHovered}
          >
            <div style={labelStyle}>
              {book.name}
            </div>
          </SmoothHtmlLabel>
        );
      })}
    </group>
  );
}
