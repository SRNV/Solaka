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
  const horizontalScale = useYearMarkersStore(s => s.cameraZoom);

  useFrame(() => {
    if (!el) return;
    const { cameraX, cameraZoom } = useYearMarkersStore.getState();
    const zoom = (camera as THREE.OrthographicCamera).zoom;
    const camX = cameraX * cameraZoom;

    const left   = size.width  / 2 + (worldX * cameraZoom - camX) * zoom;
    el.style.left = `${left}px`;
  });

  return null;
}
