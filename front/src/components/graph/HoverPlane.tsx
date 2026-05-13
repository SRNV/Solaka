import { useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CH_STEP } from '@/utils/graphConstants.ts';
import type { LayoutResult } from '@/utils/graphLayout.ts';

/** Props for the {@link HoverPlane} component. */
interface HoverPlaneProps {
  bookLabels:    LayoutResult['bookLabels'];
  totalX:        number;
  maxTowerY:     number;
  hoveredBook:   string | null;
  /** Called with the book name under the pointer, or `null` when outside all books. */
  onHover:       (bookName: string | null) => void;
  /** Called on click if the pointer moved less than 5 px since `pointerdown` (drag guard). */
  onCanvasClick: (bookName: string | null) => void;
}

const PLANE_TOP    = 2000;
const PLANE_BOTTOM = -1000;
const PLANE_HEIGHT = PLANE_TOP - PLANE_BOTTOM;

/**
 * Invisible full-scene plane used for book hover detection and canvas click handling.
 *
 * The plane covers the full X extent of the graph and a large Y range so that pointer events
 * fire reliably regardless of zoom.  A drag guard (5 px threshold) prevents click events from
 * firing after the user pans the camera.
 */
export function HoverPlane({ bookLabels, totalX, hoveredBook, onHover, onCanvasClick }: HoverPlaneProps) {
  const { invalidate } = useThree();
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  return (
    <mesh
      position={[totalX / 2, (PLANE_TOP + PLANE_BOTTOM) / 2, 0]}
      onPointerMove={e => {
        const hitX   = e.point.x;
        const hitBook = bookLabels.find(b => hitX >= b.startX - CH_STEP / 2 && hitX <= b.endX + CH_STEP / 2);
        onHover(hitBook?.name ?? null);
        invalidate();
      }}
      onPointerLeave={() => { onHover(null); invalidate(); }}
      onPointerDown={e => { pointerDownPos.current = { x: e.clientX, y: e.clientY }; }}
      onClick={e => {
        if (!pointerDownPos.current) return;
        const dx = e.clientX - pointerDownPos.current.x;
        const dy = e.clientY - pointerDownPos.current.y;
        if (dx * dx + dy * dy > 25) return; // ignore drags
        onCanvasClick(hoveredBook);
      }}
    >
      <planeGeometry args={[totalX + 20, PLANE_HEIGHT]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}
