import { useFrame } from '@react-three/fiber';

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
