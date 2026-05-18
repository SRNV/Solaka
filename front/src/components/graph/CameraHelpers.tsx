import { useCallback, useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useYearMarkersStore } from '@/store/yearMarkers.store';

/** 
 * Master controls for horizontal-only pan and stretch.
 * Apply this only to the Master canvas (SectionMarkers).
 */
export function HorizontalMasterControls() {
  const { camera, gl, invalidate } = useThree();
  const setCameraState    = useYearMarkersStore(s => s.setCameraState);
  const setIsCameraMoving = useYearMarkersStore(s => s.setIsCameraMoving);
  const setIsZooming      = useYearMarkersStore(s => s.setIsZooming);
  
  const isDragging = useRef(false);
  const lastX      = useRef(0);
  const moveTimer  = useRef<NodeJS.Timeout | null>(null);
  const zoomTimer  = useRef<NodeJS.Timeout | null>(null);

  const triggerMove = useCallback(() => {
    setIsCameraMoving(true);
    if (moveTimer.current) clearTimeout(moveTimer.current);
    moveTimer.current = setTimeout(() => {
      setIsCameraMoving(false);
    }, 150);
  }, [setIsCameraMoving]);

  const triggerZoom = useCallback(() => {
    setIsZooming(true);
    if (zoomTimer.current) clearTimeout(zoomTimer.current);
    zoomTimer.current = setTimeout(() => {
      setIsZooming(false);
    }, 150);
  }, [setIsZooming]);

  useEffect(() => {
    const el = gl.domElement;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // Left click only
      isDragging.current = true;
      lastX.current = e.clientX;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastX.current;
      lastX.current = e.clientX;
      
      const { cameraX: currentX, cameraZoom: currentZoom } = useYearMarkersStore.getState();
      const newX = currentX - dx / currentZoom;
      setCameraState(newX, currentZoom);
      triggerMove();
      invalidate();
    };

    const onMouseUp = () => {
      isDragging.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSpeed = 0.0015;
      const delta     = -e.deltaY;
      const factor    = Math.exp(delta * zoomSpeed);
      
      const { cameraX: currentX, cameraZoom: currentZoom } = useYearMarkersStore.getState();
      const newZoom = Math.max(0.1, Math.min(100, currentZoom * factor));

      if (newZoom === currentZoom) return;

      const rect = el.getBoundingClientRect();
      const mouseXPixels = e.clientX - rect.left;
      const mouseXFromCenter = mouseXPixels - rect.width / 2;
      const newX = currentX + mouseXFromCenter * (1 / currentZoom - 1 / newZoom);

      setCameraState(newX, newZoom);
      triggerZoom();
      invalidate();
    };

    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, [gl, camera, setCameraState, invalidate]);

  return null;
}

/** Syncs camera FROM store with standard projection. */
export function CameraSync({ y = 200 }: { y?: number }) {
  const { camera, size, invalidate } = useThree();
  const cameraX    = useYearMarkersStore(s => s.cameraX);
  const cameraZoom = useYearMarkersStore(s => s.cameraZoom);

  useFrame(() => {
    const x = camera.position.x;
    const aspect = size.width / size.height;
    const frustumHeight = size.height;
    
    // Standard square projection
    const left   = -frustumHeight * aspect / 2;
    const right  =  frustumHeight * aspect / 2;
    const top    =  frustumHeight / 2;
    const bottom = -frustumHeight / 2;

    const cam = camera as any;
    const targetX = cameraX * cameraZoom;
    if (cam.left !== left || cam.right !== right || cam.top !== top || cam.bottom !== bottom || Math.abs(x - targetX) > 0.001 || Math.abs(cam.position.y - y) > 0.001) {
      cam.left   = left;
      cam.right  = right;
      cam.top    = top;
      cam.bottom = bottom;
      cam.position.set(targetX, y, 500);
      cam.rotation.set(0, 0, 0); 
      cam.updateProjectionMatrix();
      invalidate();
    }
  });
  return null;
}

/** Locks the camera's Y position to a fixed value to prevent vertical pan. */
export function LockCameraY({ y }: { y: number }) {
  useFrame(({ camera, controls }) => {
    if (Math.abs(camera.position.y - y) > 0.001) {
      camera.position.y = y;
      (controls as any)?.target?.setY(y); // Update target Y to match camera
    }
  });
  return null;
}

/**
 * On first mount, zooms the orthographic camera so that `totalX` world-units
 * fit within 88% of the canvas width, centred on `cx`.
 */
export function FitCamera({ totalX, cx, y = 200 }: { totalX: number; cx: number; y?: number }) {
  const { camera, size, invalidate } = useThree();
  const setCameraState = useYearMarkersStore(s => s.setCameraState);
  const done = useRef(false);

  useEffect(() => {
    if (done.current || size.width === 0 || totalX === 0) return;
    done.current = true;

    const baseZoom = (size.width * 0.88) / totalX;
    const finalZoom = Math.max(0.1, Math.min(10, baseZoom));
    
    // Update local camera for immediate feedback on Master
    (camera as any).zoomX = finalZoom;
    camera.position.set(cx, y, 500);
    camera.lookAt(cx, y, 0);
    camera.updateProjectionMatrix();

    // Update store for Slave
    setCameraState(cx, finalZoom);
    invalidate();
  }, [camera, size.width, totalX, cx, y, invalidate, setCameraState]);

  return null;
}
