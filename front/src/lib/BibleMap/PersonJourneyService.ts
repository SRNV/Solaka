/**
 * PersonJourneyService — date-aware journey of a single person on the globe.
 *
 * Handles multiple LineString features per person (e.g. Paul's 5 missionary
 * journeys). All lines share a unified t range [0, 1] scaled by arc length,
 * so uMaxT clipping and portrait sliding work continuously across all journeys.
 *
 * Usage
 * ─────
 *   const handle = buildPersonJourney(data, { w, h }, atlasTexture);
 *   scene.add(...handle.meshes);
 *
 *   handle.setDate(50);   // clip to year 50
 *   handle.setDate(null); // show full journey
 *   handle.setViewport(nw, nh);
 *   handle.tick(performance.now() / 1000);
 *   handle.dispose();
 */

import * as THREE from 'three';
import gsap from 'gsap';
import {
  buildAnimatedLineMesh,
  type AnimatedLineHandle,
  type LineSegment,
} from './AnimatedLineService.ts';
import { buildBillboards, type BillboardHandle } from './PersonBillboardService.ts';

// ── Constants ─────────────────────────────────────────────────────────────────

const GEODESIC_STEPS = 30;
const LINE_R         = 1.004;
const PT_R           = 1.006;

// ── Helpers ───────────────────────────────────────────────────────────────────

function lonLatToXYZ(lon: number, lat: number, r = 1.0): [number, number, number] {
  const φ = lat * (Math.PI / 180);
  const λ = lon * (Math.PI / 180);
  return [
    -Math.cos(φ) * Math.cos(λ) * r,
     Math.sin(φ)               * r,
     Math.cos(φ) * Math.sin(λ) * r,
  ];
}

/** Arc-length–based local t values [0, 1] for a single LineString's coords. */
function computeLocalTs(coords: [number, number][]): number[] {
  if (coords.length <= 1) return coords.map(() => 0);
  const cumLen = [0];
  for (let i = 1; i < coords.length; i++) {
    const a = lonLatToXYZ(coords[i - 1][0], coords[i - 1][1]);
    const b = lonLatToXYZ(coords[i][0],     coords[i][1]);
    cumLen.push(cumLen[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  const total = cumLen[cumLen.length - 1];
  return total > 0 ? cumLen.map(l => l / total) : coords.map((_, i) => i / (coords.length - 1));
}

/** Arc length (sphere surface, unit sphere) of a LineString. */
function arcLength(coords: [number, number][]): number {
  let len = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = lonLatToXYZ(coords[i - 1][0], coords[i - 1][1]);
    const b = lonLatToXYZ(coords[i][0],     coords[i][1]);
    len += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }
  return len;
}

// ── Multi-line range structure ─────────────────────────────────────────────────

interface LineRange {
  coords:    [number, number][];
  tOffset:   number;   // global t at first coord of this LineString
  tScale:    number;   // fraction of total arc length
  tAtCoord:  number[]; // global t at each coord of this LineString
}

/**
 * Computes contiguous t sub-ranges [0,1] for each LineString, scaled by arc
 * length so the ranges are proportional and gapless.
 */
function buildLineRanges(lineFeatures: any[]): LineRange[] {
  const coordsList = lineFeatures.map(lf => lf.geometry.coordinates as [number, number][]);
  const lengths    = coordsList.map(arcLength);
  const total      = lengths.reduce((s, l) => s + l, 0);

  let cumLen = 0;
  return coordsList.map((coords, i) => {
    const tOffset = total > 0 ? cumLen / total : i / lineFeatures.length;
    const tScale  = total > 0 ? lengths[i] / total : 1 / lineFeatures.length;
    const localTs = computeLocalTs(coords);
    const tAtCoord = localTs.map(t => tOffset + t * tScale);
    cumLen += lengths[i];
    return { coords, tOffset, tScale, tAtCoord };
  });
}

/** Geodesic-subdivided segments for all LineStrings with unified global t. */
function buildAllSegments(ranges: LineRange[]): LineSegment[] {
  const segments: LineSegment[] = [];
  for (const { coords, tAtCoord } of ranges) {
    for (let i = 0; i < coords.length - 1; i++) {
      const a  = new THREE.Vector3(...lonLatToXYZ(coords[i][0],     coords[i][1],     LINE_R));
      const b  = new THREE.Vector3(...lonLatToXYZ(coords[i + 1][0], coords[i + 1][1], LINE_R));
      const tA = tAtCoord[i];
      const tB = tAtCoord[i + 1];
      for (let j = 0; j < GEODESIC_STEPS; j++) {
        const p0 = a.clone().lerp(b, j       / GEODESIC_STEPS).normalize().multiplyScalar(LINE_R);
        const p1 = a.clone().lerp(b, (j + 1) / GEODESIC_STEPS).normalize().multiplyScalar(LINE_R);
        segments.push({
          start: [p0.x, p0.y, p0.z],
          end:   [p1.x, p1.y, p1.z],
          t:     tA + (tB - tA) *  j      / GEODESIC_STEPS,
          tEnd:  tA + (tB - tA) * (j + 1) / GEODESIC_STEPS,
        });
      }
    }
  }
  return segments;
}

/**
 * Sphere-surface position at global t across all LineStrings.
 * Finds the range that contains t, then interpolates geodesically.
 */
function getSpherePosAtT(
  t: number,
  ranges: LineRange[],
  r = PT_R,
): [number, number, number] {
  if (ranges.length === 0) return [0, 0, r];
  if (t <= 0) return lonLatToXYZ(ranges[0].coords[0][0], ranges[0].coords[0][1], r);

  // Find the range that contains t (or the last range that has started)
  let active = ranges[ranges.length - 1];
  for (const range of ranges) {
    if (t >= range.tOffset) active = range;
    else break;
  }

  const { coords, tAtCoord } = active;

  // Find segment within this range
  for (let i = 0; i < tAtCoord.length - 1; i++) {
    if (t >= tAtCoord[i] && t <= tAtCoord[i + 1] + 1e-9) {
      const span = tAtCoord[i + 1] - tAtCoord[i];
      const segT = span > 1e-9 ? (t - tAtCoord[i]) / span : 0;
      const a = new THREE.Vector3(...lonLatToXYZ(coords[i][0],     coords[i][1]));
      const b = new THREE.Vector3(...lonLatToXYZ(coords[i + 1][0], coords[i + 1][1]));
      const p = a.lerp(b, segT).normalize().multiplyScalar(r);
      return [p.x, p.y, p.z];
    }
  }

  // Clamp to last coord of this range
  return lonLatToXYZ(coords[coords.length - 1][0], coords[coords.length - 1][1], r);
}

// ── Types ─────────────────────────────────────────────────────────────────────

import type { PersonJourneyData, PersonJourneyHandle } from '@/models/bibleMap';
export type { PersonJourneyData, PersonJourneyHandle };

interface Waypoint {
  arrival: number;
  t: number;
}

// ── Shader for visited-place dots ─────────────────────────────────────────────

const ptVert = /* glsl */`
  uniform float uSize;
  void main() {
    gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize;
  }
`;

const ptFrag = /* glsl */`
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(0.831, 0.675, 0.051, 0.9); // gold #D4AC0D
  }
`;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Builds a date-aware journey for a single person.
 * Handles multiple LineString features (e.g. several missionary journeys).
 */
export function buildPersonJourney(
  data: PersonJourneyData,
  viewport: { w: number; h: number },
  atlasTexture: THREE.Texture,
): PersonJourneyHandle {
  const { features, atlasEntry, borderType = 2 } = data;

  const lineFeatures = features.filter((f: any) => f.geometry?.type === 'LineString');
  const ptFeatures   = features.filter((f: any) => f.geometry?.type === 'Point');

  if (lineFeatures.length === 0) {
    return { meshes: [], setDate: () => {}, setViewport: () => {}, tick: () => {}, dispose: () => {} };
  }

  // ── Build global t ranges across all LineStrings ───────────────────────────
  const ranges = buildLineRanges(lineFeatures);

  // ── Match each Point to the closest coord across all LineStrings ───────────
  const waypoints: Waypoint[] = ptFeatures
    .map((f: any) => {
      const [lon, lat] = f.geometry.coordinates as [number, number];
      const dates: number[] = Array.isArray(f.properties?.dates) ? f.properties.dates : [];
      const arrival = dates[0] ?? 0;

      let bestT    = 0;
      let bestDist = Infinity;
      for (const { coords, tAtCoord } of ranges) {
        for (let i = 0; i < coords.length; i++) {
          const d = Math.hypot(lon - coords[i][0], lat - coords[i][1]);
          if (d < bestDist) { bestDist = d; bestT = tAtCoord[i]; }
        }
      }
      return { arrival, t: bestT };
    })
    .sort((a, b) => a.t - b.t);

  // ── Animated line ──────────────────────────────────────────────────────────
  const segments:   LineSegment[]      = buildAllSegments(ranges);
  const lineHandle: AnimatedLineHandle = buildAnimatedLineMesh(segments, viewport, { maxT: 1.0 });

  // ── Visited-place dots ─────────────────────────────────────────────────────
  const ptPos = new Float32Array(ptFeatures.length * 3);
  for (let i = 0; i < ptFeatures.length; i++) {
    const [lon, lat] = ptFeatures[i].geometry.coordinates as [number, number];
    const [x, y, z]  = lonLatToXYZ(lon, lat, PT_R);
    ptPos[i * 3] = x; ptPos[i * 3 + 1] = y; ptPos[i * 3 + 2] = z;
  }
  const ptGeo = new THREE.BufferGeometry();
  ptGeo.setAttribute('position', new THREE.BufferAttribute(ptPos, 3));
  const ptMat = new THREE.ShaderMaterial({
    vertexShader:   ptVert,
    fragmentShader: ptFrag,
    transparent:    true,
    depthWrite:     false,
    uniforms: { uSize: { value: 5.0 } },
  });
  const ptsMesh = new THREE.Points(ptGeo, ptMat);

  // ── Portrait billboard (position updated each frame via GSAP) ─────────────
  const initPos = getSpherePosAtT(1.0, ranges, PT_R);
  const portraitHandle: BillboardHandle = buildBillboards(
    [{ lon: 0, lat: 0, atlasX: atlasEntry.x, atlasY: atlasEntry.y, borderType }],
    viewport,
    atlasTexture,
    { pinSizePx: 32, sphereR: PT_R },
  );
  portraitHandle.setCenter(0, initPos[0], initPos[1], initPos[2]);

  // ── GSAP-animated maxT ─────────────────────────────────────────────────────
  const maxTRef = { value: 1.0 };
  let tween: gsap.core.Tween | null = null;

  const applyMaxT = (t: number) => {
    lineHandle.setMaxT(t);
    if (t < 0.01) {
      portraitHandle.setVisible(false);
    } else {
      portraitHandle.setVisible(true);
      const [x, y, z] = getSpherePosAtT(t, ranges, PT_R);
      portraitHandle.setCenter(0, x, y, z);
    }
  };

  const computeTarget = (year: number | null): number => {
    if (year === null || waypoints.length === 0) return 1.0;
    const passed = waypoints.filter(wp => wp.arrival <= year);
    if (passed.length === 0) return 0.0;
    if (passed.length === waypoints.length) return 1.0;
    return passed[passed.length - 1].t;
  };

  // Start fully visible
  applyMaxT(maxTRef.value);

  return {
    meshes: [lineHandle.mesh, ptsMesh, portraitHandle.mesh],

    setDate(year) {
      const target = computeTarget(year);
      tween?.kill();
      tween = gsap.to(maxTRef, {
        value:    target,
        duration: 1.0,
        ease:     'power2.inOut',
        onUpdate() { applyMaxT(maxTRef.value); },
      });
    },

    setViewport(w, h) {
      lineHandle.setViewport(w, h);
      portraitHandle.setViewport(w, h);
    },

    tick(t) {
      lineHandle.tick(t);
    },

    dispose() {
      tween?.kill();
      lineHandle.dispose();
      ptGeo.dispose();
      ptMat.dispose();
      portraitHandle.dispose();
    },
  };
}
