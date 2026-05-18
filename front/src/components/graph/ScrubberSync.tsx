import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useYearMarkersStore } from '@/store/yearMarkers.store';

interface Props {
  worldX:    number;
  maxTowerY: number;
}

/** Null-render R3F component: positions the DOM scrubber handle each frame via the store element. */
export function ScrubberSync({ worldX, maxTowerY }: Props) {
  const { camera, size } = useThree();
  const el = useYearMarkersStore(s => s.scrubberHandleEl);

  useFrame(() => {
    if (!el) return;
    const zoom = (camera as THREE.OrthographicCamera).zoom;
    const camX = camera.position.x;

    const left   = size.width  / 2 + (worldX - camX) * zoom;
    const top    = size.height / 2 - maxTowerY * zoom;
    const bottom = size.height / 2;

    el.style.left   = `${left}px`;
    el.style.top    = `${top}px`;
    el.style.height = `${Math.max(0, bottom - top)}px`;
  });

  return null;
}
