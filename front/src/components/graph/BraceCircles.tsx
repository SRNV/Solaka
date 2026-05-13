import { Html } from '@react-three/drei';
import type { BraceCircle } from '@/utils/graphRelations.ts';
import { CIRCLE_PX } from '@/utils/graphConstants.ts';

interface BraceCirclesProps {
  circles:    BraceCircle[];
  visible:    boolean;
  onRelClick: (relIdx: number) => void;
}

/**
 * Renders clickable HTML circle overlays at the midpoint of each brace bar.
 * Only mounted when zoom >= {@link CIRCLE_ZOOM_THRESH}.
 */
export function BraceCircles({ circles, visible, onRelClick }: BraceCirclesProps) {
  if (!visible) return null;
  return (
    <>
      {circles.map((circle, i) => (
        <Html key={i} center position={[circle.x, circle.y, 0.02]} zIndexRange={[0, 0]}>
          <div
            onClick={e => { e.stopPropagation(); onRelClick(circle.relIdx); }}
            style={{
              width:          CIRCLE_PX,
              height:         CIRCLE_PX,
              borderRadius:   '50%',
              background:     circle.color,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              color:          '#fff',
              fontSize:       10,
              fontWeight:     900,
              lineHeight:     1,
              cursor:         'pointer',
              userSelect:     'none',
              boxShadow:      '0 0 3px rgba(0,0,0,0.35)',
              transform:      `translateX(${circle.side * (CIRCLE_PX / 2)}px)`,
            }}
          >+</div>
        </Html>
      ))}
    </>
  );
}
