/**
 * AnimatedLineService — screen-space thick animated line renderer.
 *
 * Produces a quad-mesh ribbon with a traveling Gaussian pulse and a 4-stop
 * gradient. The caller supplies pre-computed 3-D segments with a [0,1] t
 * value; geodesic subdivision / coordinate conversion live in the feature layer.
 *
 * Usage
 * ─────
 *   const line  = buildAnimatedLineMesh(segments, { w, h });
 *   const arrow = buildArrowMesh(arrowDefs, { w, h });
 *
 *   // in resize handler
 *   line.setViewport(nw, nh);
 *   arrow.setViewport(nw, nh);
 *
 *   // in animation loop
 *   line.tick(performance.now() / 1000);
 *
 *   // on teardown
 *   line.dispose();
 *   arrow.dispose();
 */

import * as THREE from 'three';

// ── Shader sources ────────────────────────────────────────────────────────────

const lineVert = /* glsl */`
  attribute vec3  aStart;
  attribute vec3  aEnd;
  attribute vec2  aCorner;   // x: side (-1/+1), y: which endpoint (0/1)
  attribute float aT;        // progress along path [0, 1]
  attribute float aQuadT;    // start-t of the quad (same for all 4 corners)

  uniform vec2  uViewport;
  uniform float uWidth;      // base width in pixels
  uniform float uTime;       // seconds
  uniform float uPulseHz;    // pulse frequency
  uniform float uPulseScale; // max width multiplier
  uniform float uMaxT;       // clip limit — quads at aQuadT >= uMaxT are hidden

  varying float vT;
  varying float vSide; // -1 (left edge) → +1 (right edge), interpolated across quad

  void main() {
    vT    = aT;
    vSide = aCorner.x;

    vec4 clipA = projectionMatrix * modelViewMatrix * vec4(aStart, 1.0);
    vec4 clipB = projectionMatrix * modelViewMatrix * vec4(aEnd,   1.0);

    vec2 ndcA = clipA.xy / clipA.w;
    vec2 ndcB = clipB.xy / clipB.w;
    vec2 dir  = normalize((ndcB - ndcA) * uViewport);
    vec2 perp = vec2(-dir.y, dir.x);

    // Traveling Gaussian pulse — wraps seamlessly at t=0/1
    float phase = fract(uTime * uPulseHz);
    float dist  = aT - phase;
    dist        = dist - floor(dist + 0.5);
    float pulse = exp(-pow(dist * 5.5, 2.0));
    float w     = uWidth * (1.0 + (uPulseScale - 1.0) * pulse);

    vec4 clip = mix(clipA, clipB, aCorner.y);
    clip.xy  += perp * aCorner.x * w / uViewport * clip.w;
    clip.z   += 0.0001 * clip.w; // behind arrows

    gl_Position = clip;
    // Hide quads beyond the clip limit (push off-screen)
    if (aQuadT >= uMaxT) gl_Position = vec4(9999.0, 0.0, 0.0, 1.0);
  }
`;

const lineFrag = /* glsl */`
  varying float vT;
  varying float vSide;

  uniform vec3  uColor0;
  uniform vec3  uColor1;
  uniform vec3  uColor2;
  uniform vec3  uColor3;
  uniform float uOpacity;
  uniform vec3  uOutlineColor;
  uniform float uOutlineFrac; // fraction of half-width that is outline [0, 1]

  vec3 gradColor(float t) {
    float s = clamp(t, 0.0, 1.0) * 3.0;
    if (s < 1.0) return mix(uColor0, uColor1, s);
    if (s < 2.0) return mix(uColor1, uColor2, s - 1.0);
    return mix(uColor2, uColor3, s - 2.0);
  }

  void main() {
    // abs(vSide) goes from 0 (center) to 1 (edge)
    float edge = abs(vSide);
    float inner = 1.0 - uOutlineFrac;
    // smooth transition between gradient interior and outline
    float outlineMix = smoothstep(inner - 0.05, inner + 0.05, edge);
    vec3 col = mix(gradColor(vT), uOutlineColor, outlineMix);
    gl_FragColor = vec4(col, uOpacity);
  }
`;

const arrowVert = /* glsl */`
  attribute vec3 aCenter;
  attribute vec3 aTangent;
  attribute vec2 aLocal;    // (x: lateral, y: forward) in arrow frame

  uniform vec2  uViewport;
  uniform float uSize;

  void main() {
    vec4 clip  = projectionMatrix * modelViewMatrix * vec4(aCenter, 1.0);
    vec4 clipT = projectionMatrix * modelViewMatrix * vec4(aCenter + aTangent * 0.005, 1.0);

    vec2 dir  = normalize((clipT.xy / clipT.w - clip.xy / clip.w) * uViewport);
    vec2 perp = vec2(-dir.y, dir.x);

    vec2 off  = (dir * aLocal.y + perp * aLocal.x) * uSize / uViewport;
    clip.xy  += off * clip.w;
    clip.z   -= 0.0001 * clip.w; // on top of line ribbon

    gl_Position = clip;
  }
`;

const arrowFrag = /* glsl */`
  uniform vec3 uColor;
  void main() {
    gl_FragColor = vec4(uColor, 1.0);
  }
`;

// ── Types ─────────────────────────────────────────────────────────────────────

import type { LineSegment, ArrowDef, AnimatedLineOptions, AnimatedLineHandle, ArrowHandle } from '@/models/bibleMap';
export type { LineSegment, ArrowDef, AnimatedLineOptions, AnimatedLineHandle, ArrowHandle };

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Builds a thick animated gradient line ribbon from pre-computed 3-D segments.
 * Each segment must carry a `t` value [0,1] indicating its position along the path.
 */
export function buildAnimatedLineMesh(
  segments: LineSegment[],
  viewport: { w: number; h: number },
  opts: AnimatedLineOptions = {},
): AnimatedLineHandle {
  const {
    width        = 3.5,
    pulseHz      = 0.85,
    pulseScale   = 5,
    opacity      = 0.88,
    colors       = [0xC879FF, 0x3BF4FB, 0xCAFF8A, 0xD4AC0D],
    outlineColor = 0xC879FF,
    outlineFrac  = 0.18,
    maxT         = 1.0,
  } = opts;

  const aStarts:  number[] = [];
  const aEnds:    number[] = [];
  const aCorners: number[] = [];
  const aTs:      number[] = [];
  const aQuadTs:  number[] = [];
  const indices:  number[] = [];
  let vi = 0;

  for (const seg of segments) {
    const [sx, sy, sz] = seg.start;
    const [ex, ey, ez] = seg.end;
    const tEnd = seg.tEnd ?? seg.t;
    // 4 corners per quad — ep=0 → start side (t), ep=1 → end side (tEnd)
    for (const [side, ep] of [[-1, 0], [1, 0], [1, 1], [-1, 1]] as const) {
      aStarts.push(sx, sy, sz);
      aEnds.push(ex, ey, ez);
      aCorners.push(side, ep);
      aTs.push(ep === 0 ? seg.t : tEnd);
      aQuadTs.push(seg.t); // same start-t for all 4 corners — used for clipping
    }
    indices.push(vi, vi + 1, vi + 2,  vi, vi + 2, vi + 3);
    vi += 4;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('aStart',  new THREE.Float32BufferAttribute(aStarts,  3));
  geo.setAttribute('aEnd',    new THREE.Float32BufferAttribute(aEnds,    3));
  geo.setAttribute('aCorner', new THREE.Float32BufferAttribute(aCorners, 2));
  geo.setAttribute('aT',      new THREE.Float32BufferAttribute(aTs,      1));
  geo.setAttribute('aQuadT',  new THREE.Float32BufferAttribute(aQuadTs,  1));
  geo.setIndex(indices);

  const [c0, c1, c2, c3] = colors.map(c => new THREE.Color(c));

  const material = new THREE.ShaderMaterial({
    vertexShader:   lineVert,
    fragmentShader: lineFrag,
    transparent:    true,
    depthWrite:     false,
    side:           THREE.DoubleSide,
    uniforms: {
      uViewport:   { value: new THREE.Vector2(viewport.w, viewport.h) },
      uWidth:      { value: width },
      uTime:       { value: 0 },
      uPulseHz:    { value: pulseHz },
      uPulseScale: { value: pulseScale },
      uOpacity:    { value: opacity },
      uMaxT:         { value: maxT },
      uColor0:       { value: c0 },
      uColor1:       { value: c1 },
      uColor2:       { value: c2 },
      uColor3:       { value: c3 },
      uOutlineColor: { value: new THREE.Color(outlineColor) },
      uOutlineFrac:  { value: outlineFrac },
    },
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;

  return {
    mesh,
    material,
    setViewport: (w, h) => material.uniforms.uViewport.value.set(w, h),
    tick:        (t)    => { material.uniforms.uTime.value = t; },
    setMaxT:     (t)    => { material.uniforms.uMaxT.value = t; },
    getMaxT:     ()     => material.uniforms.uMaxT.value as number,
    dispose:     ()     => { geo.dispose(); material.dispose(); },
  };
}

// ── Arrow ─────────────────────────────────────────────────────────────────────

export interface ArrowOptions {
  /** Arrow size in pixels (default 8) */
  size?:  number;
  /** Fill color (default gold #D4AC0D) */
  color?: THREE.ColorRepresentation;
}

/**
 * Builds a batch of filled triangle arrows — one per entry in `defs`.
 * Each arrow is positioned at `center` and oriented along `tangent`.
 */
export function buildArrowMesh(
  defs: ArrowDef[],
  viewport: { w: number; h: number },
  opts: ArrowOptions = {},
): ArrowHandle {
  const { size = 8, color = 0xD4AC0D } = opts;

  // Tip=(0,1), left-base=(-0.6,-0.5), right-base=(0.6,-0.5)
  const TRI_LOCAL = [[0, 1], [-0.6, -0.5], [0.6, -0.5]] as const;

  const aCenters:  number[] = [];
  const aTangents: number[] = [];
  const aLocals:   number[] = [];

  for (const { center, tangent } of defs) {
    for (const [lx, ly] of TRI_LOCAL) {
      aCenters.push(center.x,  center.y,  center.z);
      aTangents.push(tangent.x, tangent.y, tangent.z);
      aLocals.push(lx, ly);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('aCenter',  new THREE.Float32BufferAttribute(aCenters,  3));
  geo.setAttribute('aTangent', new THREE.Float32BufferAttribute(aTangents, 3));
  geo.setAttribute('aLocal',   new THREE.Float32BufferAttribute(aLocals,   2));

  const material = new THREE.ShaderMaterial({
    vertexShader:   arrowVert,
    fragmentShader: arrowFrag,
    transparent:    false,
    depthWrite:     true,
    uniforms: {
      uViewport: { value: new THREE.Vector2(viewport.w, viewport.h) },
      uSize:     { value: size },
      uColor:    { value: new THREE.Color(color) },
    },
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;

  return {
    mesh,
    material,
    setViewport: (w, h) => material.uniforms.uViewport.value.set(w, h),
    dispose:     ()     => { geo.dispose(); material.dispose(); },
  };
}
