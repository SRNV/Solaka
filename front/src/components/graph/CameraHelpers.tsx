import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useYearMarkersStore } from '@/store/yearMarkers.store';

/** Writes the main canvas camera's X and zoom to yearMarkers.store on change. */
export function CameraReporter() {
  const setCameraState = useYearMarkersStore(s => s.setCameraState);
  const prevRef = useRef({ x: 0, zoom: 1 });
  useFrame(({ camera }) => {
    const x    = camera.position.x;
    const zoom = (camera as any).zoom ?? 1;
    if (x !== prevRef.current.x || zoom !== prevRef.current.zoom) {
      prevRef.current = { x, zoom };
      setCameraState(x, zoom);
    }
  });
  return null;
}

/** Locks the camera's Y position to a fixed value to prevent vertical pan. */
export function LockCameraY({ y }: { y: number }) {
  useFrame(({ camera, controls }) => {
    if (Math.abs(camera.position.y - y) > 0.001) {
      camera.position.y = y;
      (controls as any)?.target?.setY(0);
    }
  });
  return null;
}

/**
 * On first mount, zooms the orthographic camera so that `totalX` world-units
 * fit within 88% of the canvas width, centred on `cx`.
 */
export function FitCamera({ totalX, cx }: { totalX: number; cx: number }) {
  const { camera, size, invalidate } = useThree();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || size.width === 0 || totalX === 0) return;
    done.current = true;

    const baseZoom = (size.width * 0.88) / totalX;
    (camera as any).zoom = Math.max(0.2, Math.min(2, baseZoom));
    camera.position.x = cx;
    camera.position.y = 200;
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, totalX, cx, invalidate]);

  return null;
}
