import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { usePatristicCommentStore } from '@/store/comment.store.ts';
import type { LayoutResult } from '@/utils/graphLayout.ts';
import atlasIndex from '@/data/atlas.json';
import authorPositions from '@/data/authorPositions.json';

const BRACE_BOTTOM_Y = -2.0;
const GAP            = 1.5;
const SQUARE_S       = 5.5;
const BASE_Y         = BRACE_BOTTOM_Y - GAP - SQUARE_S / 2;
const BORDER_FRAC    = 0.04;

const ATLAS_W   = 512;
const ATLAS_H   = 576;
const TILE_UV_W = 64 / ATLAS_W;
const TILE_UV_H = 64 / ATLAS_H;

// --secondary: #C879FF  →  vec3(0.784, 0.475, 1.0)
// --gold:      #D4AC0D  →  vec3(0.831, 0.675, 0.051)

const VERT = /* glsl */`
  attribute vec2  aUv;
  attribute vec2  aAtlas;
  attribute float aBorderType;
  attribute float aCenterX;
  attribute float aCenterY;
  varying   vec2  vUv;
  varying   vec2  vAtlasUv;
  varying   float vBorderType;

  uniform vec2 uAtlasTile;
  uniform vec2 uHoverRange; // x=xMin, y=xMax; disabled when y < x

  void main() {
    vUv         = aUv;
    vAtlasUv    = aAtlas + aUv * uAtlasTile;
    vBorderType = aBorderType;

    float isHov = (uHoverRange.y >= uHoverRange.x
                   && aCenterX >= uHoverRange.x
                   && aCenterX <= uHoverRange.y) ? 1.0 : 0.0;

    float scale = 1.0 + isHov * 0.12;
    vec3  pos   = position;
    pos.x = aCenterX + (pos.x - aCenterX) * scale;
    pos.y = aCenterY + (pos.y - aCenterY) * scale;

    vec4 clip = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    clip.z   -= isHov * 0.01 * clip.w;
    gl_Position = clip;
  }
`;

const FRAG = /* glsl */`
  uniform sampler2D uAtlas;
  uniform float     uB;
  varying vec2      vUv;
  varying vec2      vAtlasUv;
  varying float     vBorderType;

  void main() {
    bool border = vUv.x < uB || vUv.x > 1.0 - uB
               || vUv.y < uB || vUv.y > 1.0 - uB;
    if (border) {
      vec3 col = mix(vec3(0.784, 0.475, 1.0), vec3(0.831, 0.675, 0.051), vBorderType);
      gl_FragColor = vec4(col, 1.0);
    } else {
      gl_FragColor = texture2D(uAtlas, vAtlasUv);
    }
  }
`;

const HS         = SQUARE_S / 2;
const CORNERS    = [[-HS, -HS], [HS, -HS], [HS, HS], [-HS, HS]] as const;
const UV_CORNERS = [[0, 0],     [1, 0],    [1, 1],   [0, 1]]    as const;
const TRI_IDX    = [0, 1, 2, 0, 2, 3] as const;

type AtlasEntry = { x: number; y: number; width: number; height: number };
type PosEntry   = { type: 'patristic' | 'magistere' };

const atlas   = atlasIndex       as Record<string, AtlasEntry>;
const posMap  = authorPositions  as Record<string, PosEntry>;

function atlasUV(slug: string): [number, number] {
  const entry = atlas[slug];
  if (!entry) return [0, 1 - TILE_UV_H];
  const u0 = entry.x / ATLAS_W;
  const v0 = 1 - (entry.y + 64) / ATLAS_H;
  return [u0, v0];
}

function borderType(slug: string): number {
  return posMap[slug]?.type === 'magistere' ? 1.0 : 0.0;
}

function buildGeometry(
  squares: { x: number; y: number; z: number; u0: number; v0: number; bt: number }[],
): THREE.BufferGeometry {
  const n            = squares.length;
  const positions    = new Float32Array(n * 4 * 3);
  const aUvs         = new Float32Array(n * 4 * 2);
  const aAtlas       = new Float32Array(n * 4 * 2);
  const aBorderTypes = new Float32Array(n * 4);
  const aCenterXs    = new Float32Array(n * 4);
  const aCenterYs    = new Float32Array(n * 4);
  const indices      = new Uint32Array(n * 6);

  for (let i = 0; i < n; i++) {
    const { x, y, z, u0, v0, bt } = squares[i];
    const vBase = i * 4;

    for (let c = 0; c < 4; c++) {
      const vi = (vBase + c) * 3;
      positions[vi]     = x + CORNERS[c][0];
      positions[vi + 1] = y + CORNERS[c][1];
      positions[vi + 2] = z;

      const ui = (vBase + c) * 2;
      aUvs[ui]     = UV_CORNERS[c][0];
      aUvs[ui + 1] = UV_CORNERS[c][1];

      const ai = (vBase + c) * 2;
      aAtlas[ai]     = u0;
      aAtlas[ai + 1] = v0;

      aBorderTypes[vBase + c] = bt;
      aCenterXs[vBase + c]    = x;
      aCenterYs[vBase + c]    = y;
    }

    const iBase = i * 6;
    for (let t = 0; t < 6; t++) indices[iBase + t] = vBase + TRI_IDX[t];
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',    new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aUv',         new THREE.BufferAttribute(aUvs, 2));
  geo.setAttribute('aAtlas',      new THREE.BufferAttribute(aAtlas, 2));
  geo.setAttribute('aBorderType', new THREE.BufferAttribute(aBorderTypes, 1));
  geo.setAttribute('aCenterX',    new THREE.BufferAttribute(aCenterXs, 1));
  geo.setAttribute('aCenterY',    new THREE.BufferAttribute(aCenterYs, 1));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  return geo;
}

interface CommentSquaresMeshProps {
  layout:            LayoutResult;
  hoverRange:        { min: number; max: number } | null;
  extraVisibleXSet:  ReadonlySet<number> | null;
}

export function CommentSquaresMesh({ layout, hoverRange, extraVisibleXSet }: CommentSquaresMeshProps) {
  const summaries      = usePatristicCommentStore(s => s.summaries);
  const { invalidate } = useThree();
  const matRef         = useRef<THREE.ShaderMaterial | null>(null);

  const squares = useMemo(() => {
    const byX = new Map<number, string>();
    for (const [uuid, summary] of summaries) {
      if (summary.count === 0) continue;
      const pos = layout.uuidPosMap.get(uuid);
      if (!pos) continue;
      if (!byX.has(pos.x)) byX.set(pos.x, summary.authors[0]?.slug ?? '');
    }
    return [...byX.entries()]
      .filter(([x]) => {
        if (hoverRange && x >= hoverRange.min && x <= hoverRange.max) return true;
        if (extraVisibleXSet?.has(x)) return true;
        return false;
      })
      .map(([x, slug]) => {
        const [u0, v0] = atlasUV(slug);
        return { x, y: BASE_Y, z: 0, u0, v0, bt: borderType(slug) };
      });
  }, [summaries, layout.uuidPosMap, hoverRange, extraVisibleXSet]);

  // Debounce geometry rebuilds to avoid flash through zero squares
  const [stableSquares, setStableSquares] = useState(squares);
  useEffect(() => {
    const t = setTimeout(() => setStableSquares(squares), 80);
    return () => clearTimeout(t);
  }, [squares]);

  const geometry = useMemo(
    () => (stableSquares.length > 0 ? buildGeometry(stableSquares) : null),
    [stableSquares],
  );

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader:   VERT,
      fragmentShader: FRAG,
      uniforms: {
        uAtlas:      { value: new THREE.Texture() },
        uAtlasTile:  { value: new THREE.Vector2(TILE_UV_W, TILE_UV_H) },
        uB:          { value: BORDER_FRAC },
        uHoverRange: { value: new THREE.Vector2(0, -1) }, // disabled
      },
      side: THREE.DoubleSide,
    });
    matRef.current = mat;
    return mat;
  }, []);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load('/atlas.png', tex => {
      material.uniforms.uAtlas.value = tex;
      invalidate();
    });
  }, [material, invalidate]);

  // useLayoutEffect syncs uniform with geometry in the same frame — avoids one-frame mismatch
  useLayoutEffect(() => {
    const mat = matRef.current;
    if (!mat) return;
    if (hoverRange) {
      mat.uniforms.uHoverRange.value.set(hoverRange.min, hoverRange.max);
    } else {
      mat.uniforms.uHoverRange.value.set(0, -1);
    }
    invalidate();
  }, [hoverRange, invalidate]);

  useEffect(() => () => { geometry?.dispose(); }, [geometry]);
  useEffect(() => () => { material.dispose(); },  [material]);

  if (!geometry) return null;

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}
