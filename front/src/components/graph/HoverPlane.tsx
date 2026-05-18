import { useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useYearMarkersStore } from '@/store/yearMarkers.store';
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
  onCanvasClick: (bookName: string | null, worldX: number) => void;
}

const PLANE_TOP    = 2000;
const PLANE_BOTTOM = -1000;
const PLANE_HEIGHT = PLANE_TOP - PLANE_BOTTOM;

/**
 * Invisible full-scene plane used for book hover detection and canvas click handling.
 */
export function HoverPlane({ bookLabels, totalX, hoveredBook, onHover, onCanvasClick }: HoverPlaneProps) {
  const { invalidate } = useThree();
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const horizontalScale = useYearMarkersStore(s => s.cameraZoom);

  return (
    <mesh
      position={[(totalX * horizontalScale) / 2, (PLANE_TOP + PLANE_BOTTOM) / 2, 0]}
      onPointerMove={e => {
        const hitX   = e.point.x;
        const hitBook = bookLabels.find(b => {
          const sX = b.startX * horizontalScale;
          const eX = b.endX   * horizontalScale;
          return hitX >= sX - (CH_STEP * horizontalScale) / 2 && hitX <= eX + (CH_STEP * horizontalScale) / 2;
        });
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
        onCanvasClick(hoveredBook, e.point.x / horizontalScale);
      }}
    >
      <planeGeometry args={[totalX * horizontalScale + 20, PLANE_HEIGHT]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}
