import { useLayoutEffect, useRef } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { useYearMarkersStore } from '@/store/yearMarkers.store';

interface SmoothHtmlLabelProps {
  x: number;
  y: number;
  z?: number;
  visible?: boolean;
  center?: boolean;
  children: React.ReactNode;
}

/**
 * A wrapper around drei's Html component that uses GSAP to smooth out 
 * position and visibility changes. This prevents "jitter" during camera moves.
 */
export function SmoothHtmlLabel({ x, y, z = 0, visible = true, center = true, children }: SmoothHtmlLabelProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const contentRef = useRef<HTMLDivElement>(null!);
  const isZooming = useYearMarkersStore(s => s.isZooming);

  // Smooth position updates
  useLayoutEffect(() => {
    gsap.to(groupRef.current.position, {
      x,
      y,
      z,
      duration: 0.45,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  }, [x, y, z]);

  // Smooth opacity updates + hide while zooming
  useLayoutEffect(() => {
    const targetOpacity = (visible && !isZooming) ? 1 : 0;
    gsap.to(contentRef.current, {
      opacity: targetOpacity,
      duration: isZooming ? 0.1 : 0.4,
      ease: 'power1.inOut',
      overwrite: 'auto',
    });
  }, [visible, isZooming]);

  return (
    <group ref={groupRef}>
      <Html center={center} zIndexRange={[0, 0]} style={{ background: 'transparent' }}>
        <div
          ref={contentRef}
          style={{ opacity: 0, pointerEvents: 'none', background: 'transparent' }}
        >
          {children}
        </div>
      </Html>
    </group>
  );
}
