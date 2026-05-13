import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { VERT, FRAG } from '@/utils/graphShaders.ts';

/**
 * Creates, owns, and disposes the GLSL ShaderMaterial used for arc rendering.
 *
 * @param animate - When true, the pulse animation uniform (`uAnimate`) is set to 1.
 * @returns The ShaderMaterial instance (stable across renders).
 */
export function useArcMaterial(animate: boolean): THREE.ShaderMaterial {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   VERT,
    fragmentShader: FRAG,
    uniforms: {
      uResolution: { value: new THREE.Vector2(1, 1) },
      uLinePx:     { value: 4.0 },
      uTime:       { value: 0.0 },
      uAnimDur:    { value: 0.6 },
      uAnimate:    { value: 0.0 },
      uBaseColor:  { value: new THREE.Color('#f5f6fb') },
      uHoveredRel: { value: -1.0 },
      uZoomT:      { value: 0.0 },
    },
    transparent: true,
    depthWrite:  false,
    side:        THREE.DoubleSide,
  }), []);

  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(() => { mat.uniforms.uAnimate.value = animate ? 1.0 : 0.0; }, [mat, animate]);

  return mat;
}
