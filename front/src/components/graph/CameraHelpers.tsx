import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';

/** Reports the camera's X position and zoom level on every frame via a ref. */
export function CameraReporter({ onUpdate }: { onUpdate: (x: number, zoom: number) => void }) {
  useFrame(({ camera }) => {
    onUpdate(camera.position.x, (camera as any).zoom ?? 1);
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

    const zoom = (size.width * 0.88) / totalX;
    (camera as any).zoom = Math.max(0.2, Math.min(2, zoom));
    camera.position.x = cx;
    camera.position.y = 200;
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, totalX, cx, invalidate]);

  return null;
}
