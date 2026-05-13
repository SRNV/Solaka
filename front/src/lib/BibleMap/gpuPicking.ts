import * as THREE from 'three';
import { colorToInteger } from './pickingColors.ts';
import { createInnerSphere } from './sphere.ts';

const innerSphereGeometry = createInnerSphere();

export function actOnPick(
  renderer: THREE.WebGLRenderer,
  camera: THREE.Camera,
  event: MouseEvent,
  containerEl: HTMLElement,
  pickingPoints: THREE.Points,
  callback: (id: number) => void,
  nullIdCallback?: () => void,
) {
  const rect = containerEl.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / w) * 2 - 1,
    -((event.clientY - rect.top) / h) * 2 + 1,
  );

  const renderTarget = new THREE.WebGLRenderTarget(w, h);
  const pickingScene = new THREE.Scene();
  pickingScene.add(pickingPoints);
  pickingScene.add(new THREE.Mesh(
    innerSphereGeometry,
    new THREE.MeshBasicMaterial({ color: 0x000000 }),
  ));

  renderer.setRenderTarget(renderTarget);
  renderer.render(pickingScene, camera);
  renderer.setRenderTarget(null);

  const pixelBuffer = new Uint8Array(4);
  renderer.readRenderTargetPixels(
    renderTarget,
    Math.floor(((mouse.x + 1) / 2) * w),
    Math.floor(((mouse.y + 1) / 2) * h),
    1, 1, pixelBuffer,
  );

  const id = colorToInteger([pixelBuffer[0], pixelBuffer[1], pixelBuffer[2]]);
  const skip0 = colorToInteger([0, 0, 0]);
  const skip1 = colorToInteger([255, 255, 255]);
  if (id === skip0 || id === skip1) { nullIdCallback?.(); return; }
  callback(id);
}
