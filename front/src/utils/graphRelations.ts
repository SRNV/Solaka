import type { BibleRelation } from '@/types/bible.ts';
import type { Pos3 } from './graphLayout.ts';
import { BRACE_AVAIL, BRACE_TICK, ARC_SEGS } from './graphConstants.ts';

/**
 * One rendered segment of an arc (either a Bézier curve subdivision or a brace bar).
 * Four vertices are emitted per segment in the GPU buffer (two start + two end).
 */
export interface ArcSeg {
  ax: number; ay: number; az: number;
  bx: number; by: number; bz: number;
  /** World Y of the arc's control point — used for colour gradient mapping. */
  arcPeakY:    number;
  t0: number; t1: number;
  /** Index into the `relations` array — used for hover highlighting. */
  relIdx:      number;
  isAuthority: boolean;
  isCatholic:  boolean;
}

/** Per-relation brace-lane assignment produced by {@link computeLanes}. */
export interface LaneInfo {
  /** Index of this relation's brace bar within its TO-side column group. */
  toLane:    number;
  /** Total number of brace bars sharing the TO-side column gap. */
  toTotal:   number;
  /** Index of this relation's brace bar within its FROM-side column group. */
  fromLane:  number;
  /** Total number of brace bars sharing the FROM-side column gap. */
  fromTotal: number;
}

/** Clickable circle overlay placed at the midpoint of a brace bar. */
export interface BraceCircle {
  x:      number;
  y:      number;
  /** ±1 — which side of the column the brace sits on (drives CSS translateX). */
  side:   number;
  relIdx: number;
  color:  string;
}

/** X offset of a brace bar center from its column center, for lane `i` of `n` total. */
export function barOffset(laneIndex: number, totalLanes: number): number {
  const slotWidth = BRACE_AVAIL / totalLanes;
  const cubeHalfWidth = 0.4 / 2; // CUBE_S / 2 — inlined to avoid circular dep
  const braceMargin   = 0.03;    // BRACE_MARGIN — inlined to avoid circular dep
  return cubeHalfWidth + braceMargin + (laneIndex + 0.5) * slotWidth;
}

/** Tick length for `n` total braces (≤ 40% of slot width, capped at BRACE_TICK). */
export function braceTickLength(totalLanes: number): number {
  return Math.min(BRACE_TICK, (BRACE_AVAIL / totalLanes) * 0.4);
}

function mergeRangeGroup(
  group:      BibleRelation[],
  uuidPosMap: Map<string, Pos3>,
  side:       'to' | 'from',
): BibleRelation {
  let minY = Infinity, maxY = -Infinity;
  let uuidMin = side === 'to' ? group[0].toFrom : group[0].from;
  let uuidMax = side === 'to' ? group[0].toTo   : (group[0].fromTo ?? group[0].from);

  const candidates = side === 'to'
    ? group.flatMap(r => [r.toFrom, r.toTo])
    : group.flatMap(r => [r.from, r.fromTo ?? r.from]);

  for (const uuid of candidates) {
    const pos = uuidPosMap.get(uuid);
    if (!pos) continue;
    if (pos.y < minY) { minY = pos.y; uuidMin = uuid; }
    if (pos.y > maxY) { maxY = pos.y; uuidMax = uuid; }
  }

  if (side === 'to') return { ...group[0], toFrom: uuidMin, toTo: uuidMax };
  return { ...group[0], from: uuidMin, fromTo: uuidMax };
}

/**
 * Incrementally merge one incoming relation into an already-merged list.
 *
 * Called on each STOMP tick so the brace visualisation builds up progressively
 * instead of re-running the full O(n²) normalizeRelations on every arrival.
 *
 * Two merge cases (mirrors the two passes of {@link normalizeRelations}):
 *  - **TO-side**: same `from` UUID + same tradition + same destination column → extend destination range.
 *  - **FROM-side**: same destination UUIDs + same tradition + same source column → extend source range.
 *
 * If the new relation is already fully covered by an existing one it is silently dropped.
 *
 * @param existing - Current merged relation list (mutated copy is returned).
 * @param newRel   - Incoming raw relation to integrate.
 * @param posMap   - Verse UUID → world position.
 * @returns New merged relation list (existing is never mutated).
 */
export function mergeRelationIncremental(
  existing: BibleRelation[],
  newRel:   BibleRelation,
  posMap:   Map<string, Pos3>,
): BibleRelation[] {
  const newSrcPos  = posMap.get(newRel.from);
  const newDstAPos = posMap.get(newRel.toFrom);

  // ── TO-side merge: same from UUID + same trad + same destination column ──
  if (newSrcPos && newDstAPos) {
    const dstColX = newDstAPos.x;
    for (let i = 0; i < existing.length; i++) {
      const r = existing[i];
      if (r.from !== newRel.from || r.trad !== newRel.trad) continue;
      const rDstPos = posMap.get(r.toFrom);
      if (!rDstPos || Math.abs(rDstPos.x - dstColX) > 0.001) continue;

      // Check if newRel is already covered (same single-vertex destination)
      if (r.toFrom === newRel.toFrom && r.toTo === newRel.toTo) return existing;

      const candidates = [r.toFrom, r.toTo, newRel.toFrom, newRel.toTo];
      let minY = Infinity, maxY = -Infinity, uuidMin = r.toFrom, uuidMax = r.toTo;
      for (const uuid of candidates) {
        const p = posMap.get(uuid);
        if (!p) continue;
        if (p.y < minY) { minY = p.y; uuidMin = uuid; }
        if (p.y > maxY) { maxY = p.y; uuidMax = uuid; }
      }
      const merged = { ...r, toFrom: uuidMin, toTo: uuidMax };
      return [...existing.slice(0, i), merged, ...existing.slice(i + 1)];
    }
  }

  // ── FROM-side merge: same dest UUIDs + same trad + same source column ────
  if (newSrcPos) {
    const fromColX = newSrcPos.x;
    for (let i = 0; i < existing.length; i++) {
      const r = existing[i];
      if (r.toFrom !== newRel.toFrom || r.toTo !== newRel.toTo || r.trad !== newRel.trad) continue;
      const rSrcPos = posMap.get(r.from);
      if (!rSrcPos || Math.abs(rSrcPos.x - fromColX) > 0.001) continue;

      // Check if already covered (same single-vertex source, same fromTo)
      if (r.from === newRel.from && (r.fromTo ?? r.from) === (newRel.fromTo ?? newRel.from)) return existing;

      const candidates = [r.from, r.fromTo ?? r.from, newRel.from, newRel.fromTo ?? newRel.from];
      let minY = Infinity, maxY = -Infinity, uuidMin = r.from, uuidMax = r.from;
      for (const uuid of candidates) {
        const p = posMap.get(uuid);
        if (!p) continue;
        if (p.y < minY) { minY = p.y; uuidMin = uuid; }
        if (p.y > maxY) { maxY = p.y; uuidMax = uuid; }
      }
      const merged = { ...r, from: uuidMin, fromTo: uuidMax };
      return [...existing.slice(0, i), merged, ...existing.slice(i + 1)];
    }
  }

  return [...existing, newRel];
}

/**
 * Deduplicate + merge adjacent same-column verse ranges on both the from-side and to-side.
 * Pass 1: merge same source → same destination column (TO-side brace).
 * Pass 2: merge same destination → same source column (FROM-side brace).
 */
export function normalizeRelations(
  relations:  BibleRelation[],
  uuidPosMap: Map<string, Pos3>,
): BibleRelation[] {
  const seen = new Set<string>();
  const deduped = relations.filter(r => {
    const key = `${r.from}|${r.fromTo ?? ''}|${r.toFrom}|${r.toTo}|${r.trad}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Pass 1 — merge TO-side ranges with the same source + same destination column
  const toGroups = new Map<string, BibleRelation[]>();
  for (let ri = 0; ri < deduped.length; ri++) {
    const r = deduped[ri];
    const posFrom = uuidPosMap.get(r.toFrom);
    const posTo   = uuidPosMap.get(r.toTo);
    const isSameColumn = posFrom && posTo && Math.abs(posFrom.x - posTo.x) <= 0.001;
    if (!isSameColumn) {
      toGroups.set(`solo_${ri}_${r.trad}`, [r]);
      continue;
    }
    const groupKey = `${r.from}|${r.trad}|${posFrom.x.toFixed(4)}`;
    if (!toGroups.has(groupKey)) toGroups.set(groupKey, []);
    toGroups.get(groupKey)!.push(r);
  }
  const toMerged: BibleRelation[] = [];
  for (const group of toGroups.values()) {
    toMerged.push(group.length === 1 ? group[0] : mergeRangeGroup(group, uuidPosMap, 'to'));
  }

  // Pass 2 — merge FROM-side ranges with the same destination + same source column
  const fromGroups = new Map<string, BibleRelation[]>();
  for (let ri = 0; ri < toMerged.length; ri++) {
    const r = toMerged[ri];
    const posSource = uuidPosMap.get(r.from);
    if (!posSource) {
      fromGroups.set(`solo_${ri}_${r.trad}`, [r]);
      continue;
    }
    const groupKey = `${r.toFrom}|${r.toTo}|${r.trad}|${posSource.x.toFixed(4)}`;
    if (!fromGroups.has(groupKey)) fromGroups.set(groupKey, []);
    fromGroups.get(groupKey)!.push(r);
  }

  const result: BibleRelation[] = [];
  for (const group of fromGroups.values()) {
    result.push(group.length === 1 ? group[0] : mergeRangeGroup(group, uuidPosMap, 'from'));
  }
  return result;
}

/**
 * Assign brace lanes to each relation so overlapping range bars in the same
 * inter-chapter gap don't collide.
 */
export function computeLanes(
  relations:  BibleRelation[],
  uuidPosMap: Map<string, Pos3>,
): Map<number, LaneInfo> {
  interface BraceDescriptor {
    relIdx: number;
    kind:   'to' | 'from';
    colX:   number;
    dir:    number;
    minY:   number;
    maxY:   number;
  }

  const braceDescriptors: BraceDescriptor[] = [];

  for (let ri = 0; ri < relations.length; ri++) {
    const r    = relations[ri];
    const src  = uuidPosMap.get(r.from);
    const dstA = uuidPosMap.get(r.toFrom);
    const dstB = uuidPosMap.get(r.toTo);
    if (!src || !dstA || !dstB) continue;

    if (Math.abs(dstA.y - dstB.y) > 0.001) {
      const dir = dstA.x < src.x ? 1 : -1;
      braceDescriptors.push({ relIdx: ri, kind: 'to', colX: dstA.x, dir, minY: Math.min(dstA.y, dstB.y), maxY: Math.max(dstA.y, dstB.y) });
    }

    const srcEnd = r.fromTo ? uuidPosMap.get(r.fromTo) : null;
    if (srcEnd && Math.abs(srcEnd.y - src.y) > 0.001) {
      const dir = src.x < dstA.x ? 1 : -1;
      braceDescriptors.push({ relIdx: ri, kind: 'from', colX: src.x, dir, minY: Math.min(src.y, srcEnd.y), maxY: Math.max(src.y, srcEnd.y) });
    }
  }

  // Group by column + direction, sort by Y for stable lane assignment
  const columnGroups = new Map<string, BraceDescriptor[]>();
  for (const bd of braceDescriptors) {
    const key = `${bd.colX.toFixed(4)}|${bd.dir}`;
    if (!columnGroups.has(key)) columnGroups.set(key, []);
    columnGroups.get(key)!.push(bd);
  }

  const laneMap = new Map<number, LaneInfo>();
  const ensureLaneInfo = (ri: number): LaneInfo => {
    if (!laneMap.has(ri)) laneMap.set(ri, { toLane: 0, toTotal: 1, fromLane: 0, fromTotal: 1 });
    return laneMap.get(ri)!;
  };

  const sortedKeys = Array.from(columnGroups.keys()).sort((a, b) => {
    const [ax, ad] = a.split('|').map(Number);
    const [bx, bd] = b.split('|').map(Number);
    return (ax - bx) || (ad - bd);
  });

  for (const key of sortedKeys) {
    const group = columnGroups.get(key)!;
    group.sort((a, b) => a.minY - b.minY);
    const totalInGroup = group.length;
    group.forEach((bd, lane) => {
      const info = ensureLaneInfo(bd.relIdx);
      if (bd.kind === 'to') { info.toLane = lane;   info.toTotal = totalInGroup; }
      else                  { info.fromLane = lane;  info.fromTotal = totalInGroup; }
    });
  }

  return laneMap;
}

/**
 * Generate all arc + brace line segments for one tradition ('c' or 'p').
 * Each relation produces ARC_SEGS curve segments + up to 3 brace segments per range side.
 */
export function computeArcSegments(
  relations:  BibleRelation[],
  uuidPosMap: Map<string, Pos3>,
  minPeakY:   number,
  tradition:  'c' | 'p',
  lanes:      Map<number, LaneInfo>,
): ArcSeg[] {
  const segments: ArcSeg[] = [];

  for (let ri = 0; ri < relations.length; ri++) {
    const rel = relations[ri];
    if (rel.trad !== tradition) continue;

    const srcPos = uuidPosMap.get(rel.from);
    const dstA   = uuidPosMap.get(rel.toFrom);
    const dstB   = uuidPosMap.get(rel.toTo);
    if (!srcPos || !dstA || !dstB) continue;

    const srcEnd        = rel.fromTo ? uuidPosMap.get(rel.fromTo) : null;
    const isFromRange   = !!srcEnd && Math.abs(srcEnd.y - srcPos.y) > 0.001;
    const fromMidY      = isFromRange ? (srcPos.y + srcEnd!.y) / 2 : srcPos.y;
    const fromColX      = srcPos.x;

    const isToRange = Math.abs(dstA.y - dstB.y) > 0.001;
    const toMidY    = (dstA.y + dstB.y) / 2;
    const toColX    = dstA.x;

    const lane        = lanes.get(ri) ?? { toLane: 0, toTotal: 1, fromLane: 0, fromTotal: 1 };
    const isAuthority = rel.relType === 'authority';
    const isCatholic  = tradition === 'c';

    const sideFrom  = fromColX < toColX ? 1 : -1;
    const arcStartX = isFromRange ? fromColX + sideFrom * barOffset(lane.fromLane, lane.fromTotal) : fromColX;
    const arcStartY = isFromRange ? fromMidY : srcPos.y;
    const arcStartZ = srcPos.z;

    const sideTo  = toColX < fromColX ? 1 : -1;
    const arcEndX = isToRange ? toColX + sideTo * barOffset(lane.toLane, lane.toTotal) : toColX;
    const arcEndY = isToRange ? toMidY : dstA.y;
    const arcEndZ = dstA.z;

    const ctrlX  = (arcStartX + arcEndX) / 2;
    const ctrlZ  = (arcStartZ + arcEndZ) / 2;
    const peakY  = Math.max(minPeakY, Math.sqrt((arcEndX - arcStartX) ** 2 + (arcEndZ - arcStartZ) ** 2) * 0.3);

    // Bézier curve segments
    for (let i = 0; i < ARC_SEGS; i++) {
      const t0 = i / ARC_SEGS,       u0 = 1 - t0;
      const t1 = (i + 1) / ARC_SEGS, u1 = 1 - t1;
      const ax = u0*u0*arcStartX + 2*u0*t0*ctrlX + t0*t0*arcEndX;
      const ay = u0*u0*arcStartY + 2*u0*t0*peakY  + t0*t0*arcEndY;
      const az = u0*u0*arcStartZ + 2*u0*t0*ctrlZ  + t0*t0*arcEndZ;
      const bx = u1*u1*arcStartX + 2*u1*t1*ctrlX + t1*t1*arcEndX;
      const by = u1*u1*arcStartY + 2*u1*t1*peakY  + t1*t1*arcEndY;
      const bz = u1*u1*arcStartZ + 2*u1*t1*ctrlZ  + t1*t1*arcEndZ;
      const dx = bx - ax, dy = by - ay, dz = bz - az;
      if (dx*dx + dy*dy + dz*dz < 1e-12) continue;
      segments.push({ ax, ay, az, bx, by, bz, arcPeakY: peakY, t0: i / ARC_SEGS, t1: (i + 1) / ARC_SEGS, relIdx: ri, isAuthority, isCatholic });
    }

    // FROM-side brace bars
    if (isFromRange) {
      const minY  = Math.min(srcPos.y, srcEnd!.y);
      const maxY  = Math.max(srcPos.y, srcEnd!.y);
      const barX  = arcStartX;
      const tickX = barX - sideFrom * braceTickLength(lane.fromTotal);
      segments.push({ ax: barX, ay: minY, az: 0, bx: barX, by: maxY, bz: 0, arcPeakY: peakY, t0: 0, t1: 1, relIdx: ri, isAuthority, isCatholic });
      segments.push({ ax: barX, ay: minY, az: 0, bx: tickX, by: minY, bz: 0, arcPeakY: peakY, t0: 0, t1: 1, relIdx: ri, isAuthority, isCatholic });
      segments.push({ ax: barX, ay: maxY, az: 0, bx: tickX, by: maxY, bz: 0, arcPeakY: peakY, t0: 0, t1: 1, relIdx: ri, isAuthority, isCatholic });
    }

    // TO-side brace bars
    if (isToRange) {
      const minY  = Math.min(dstA.y, dstB.y);
      const maxY  = Math.max(dstA.y, dstB.y);
      const barX  = arcEndX;
      const tickX = barX - sideTo * braceTickLength(lane.toTotal);
      segments.push({ ax: barX, ay: minY, az: 0, bx: barX, by: maxY, bz: 0, arcPeakY: peakY, t0: 0, t1: 1, relIdx: ri, isAuthority, isCatholic });
      segments.push({ ax: barX, ay: minY, az: 0, bx: tickX, by: minY, bz: 0, arcPeakY: peakY, t0: 0, t1: 1, relIdx: ri, isAuthority, isCatholic });
      segments.push({ ax: barX, ay: maxY, az: 0, bx: tickX, by: maxY, bz: 0, arcPeakY: peakY, t0: 0, t1: 1, relIdx: ri, isAuthority, isCatholic });
    }
  }

  return segments;
}
