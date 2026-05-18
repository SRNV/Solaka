import { useEffect, useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { BibleStructureBook } from '@/models/bible';
import type { LayoutResult } from '@/utils/graphLayout.ts';
import { CUBE_S, V_STEP, ANIM_DURATION, easeInOutCubic } from '@/utils/graphConstants.ts';
import { useGraphModeStore } from '@/store/graphMode.store';
import { useYearMarkersStore } from '@/store/yearMarkers.store';

interface Props {
  data:   BibleStructureBook[];
  layout: LayoutResult;
}

const vert = /* glsl */`
  varying float vGradientT;
  varying float vWorldX;
  uniform float uTotalX;

  void main() {
    vec4 origin = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vWorldX     = origin.x;
    vGradientT  = clamp(origin.x / uTotalX, 0.0, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const frag = /* glsl */`
  varying float vGradientT;
  varying float vWorldX;
  uniform float uScrubberX;
  uniform vec3  uC0; // secondary
  uniform vec3  uC1; // primary

  void main() {
    if (vWorldX > uScrubberX) discard;
    gl_FragColor = vec4(mix(uC0, uC1, vGradientT), 1.0);
  }
`;

/** InstancedMesh that overlays cubes to the left of the scrubber with a [secondary→primary→success] gradient. */
export function ScrubberMask({ data, layout }: Props) {
  const { invalidate } = useThree();
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  const sortMode       = useGraphModeStore(s => s.sortMode);
  const scrubberWorldX = useYearMarkersStore(s => s.scrubberWorldX);

  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   vert,
    fragmentShader: frag,
    uniforms: {
      uTotalX:    { value: layout.totalX },
      uScrubberX: { value: -1e10 },
      uC0:        { value: new THREE.Color('#C879FF') },
      uC1:        { value: new THREE.Color('#3BF4FB') },
    },
  }), [layout.totalX]);

  // Sync scrubber position into the shader uniform
  useEffect(() => {
    material.uniforms.uScrubberX.value = scrubberWorldX ?? -1e10;
    material.uniforms.uTotalX.value    = layout.totalX;
    invalidate();
  }, [scrubberWorldX, layout.totalX, material, invalidate]);

  // ── Animation state (mirrors Cubes animation) ─────────────────
  const prevLayoutRef = useRef<LayoutResult | null>(null);
  const animStartRef  = useRef(-1);
  const fromLayoutRef = useRef<LayoutResult | null>(null);
  const needsInitRef  = useRef(true);

  useEffect(() => {
    const prev = prevLayoutRef.current;
    prevLayoutRef.current = layout;
    if (!prev) { needsInitRef.current = true; return; }
    fromLayoutRef.current = prev;
    animStartRef.current  = performance.now();
    invalidate();
  }, [layout, invalidate]);

  useFrame(({ invalidate: inv }) => {
    if (!meshRef.current) return;
    const isAnimating = animStartRef.current >= 0;
    if (!isAnimating && !needsInitRef.current) return;

    const rawT = isAnimating
      ? (performance.now() - animStartRef.current) / (ANIM_DURATION * 1000)
      : 1;
    const t = Math.min(1, rawT);
    if (isAnimating && t >= 1) animStartRef.current = -1;
    if (!isAnimating) needsInitRef.current = false;

    const eased      = easeInOutCubic(t);
    const fromLayout = isAnimating ? fromLayoutRef.current : null;
    const dummy      = new THREE.Object3D();
    let idx = 0;

    for (const book of data) {
      for (const ch of book.chapters ?? []) {
        const chZ   = layout.chapZMap.get(`${book.number}:${ch.number}`) ?? 0;
        const uuids = ch.uuids ?? [];
        const count = uuids.length || (ch.verseCount ?? 0);
        for (let v = 0; v < count; v++) {
          const uuid = uuids[v];
          const toX  = (uuid ? layout.uuidPosMap.get(uuid)?.x : undefined) ?? 0;
          const fmX  = (fromLayout && uuid ? fromLayout.uuidPosMap.get(uuid)?.x : undefined) ?? toX;
          dummy.position.set(fmX + (toX - fmX) * eased, CUBE_S / 2 + v * V_STEP, chZ);
          dummy.updateMatrix();
          meshRef.current.setMatrixAt(idx++, dummy.matrix);
        }
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (isAnimating && t < 1) inv();
  });

  if (sortMode !== 'historical') return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, layout.totalInstances]}
      frustumCulled={false}
      renderOrder={2}
      material={material}
    >
      <boxGeometry args={[CUBE_S, CUBE_S, CUBE_S]} />
    </instancedMesh>
  );
}
