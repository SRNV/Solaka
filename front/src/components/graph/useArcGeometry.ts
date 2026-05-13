import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { BibleRelation } from '@/types/bible.ts';
import type { Pos3 } from '@/utils/graphLayout.ts';
import {
  computeArcSegments, computeLanes,
  barOffset, braceTickLength,
  type ArcSeg, type BraceCircle,
} from '@/utils/graphRelations.ts';
import { gradColor } from '@/utils/graphShaders.ts';
import { HIT_W, CIRCLE_SEP } from '@/utils/graphConstants.ts';

export interface ArcGeometryResult {
  visualGeo:    THREE.BufferGeometry | null;
  hitGeo:       THREE.BufferGeometry | null;
  segs:         ArcSeg[];
  circles:      BraceCircle[];
  hasAuthority: boolean;
}

/**
 * Builds the GPU `BufferGeometry` (visual + hit) and brace-circle list for all arc relations.
 *
 * @param relations       - Normalised relations to render.
 * @param uuidPosMap      - Verse UUID → world position.
 * @param minPeakY        - Floor for arc control-point Y.
 * @param showCath        - Include Catholic arcs.
 * @param showProt        - Include Protestant arcs.
 * @param arcBornTimesRef - Ref tracking the clock time each arc first appeared (for fade-in).
 * @param clockRef        - Ref holding the current Three.js clock elapsed time.
 */
export function useArcGeometry(
  relations:       BibleRelation[],
  uuidPosMap:      Map<string, Pos3>,
  minPeakY:        number,
  showCath:        boolean,
  showProt:        boolean,
  arcBornTimesRef: React.MutableRefObject<Map<string, number>>,
  clockRef:        React.MutableRefObject<number>,
): ArcGeometryResult {
  const result = useMemo((): ArcGeometryResult => {
    const lanes    = computeLanes(relations, uuidPosMap);
    const cathSegs = showCath ? computeArcSegments(relations, uuidPosMap, minPeakY, 'c', lanes) : [];
    const protSegs = showProt ? computeArcSegments(relations, uuidPosMap, minPeakY, 'p', lanes) : [];

    const sortKey = (s: ArcSeg) => (s.isAuthority ? 2 : 0) + (s.isCatholic ? 1 : 0);
    const segs    = cathSegs.concat(protSegs).sort((a, b) => sortKey(a) - sortKey(b));

    if (!segs.length) return { visualGeo: null, hitGeo: null, segs: [], circles: [], hasAuthority: false };

    // Peak Y range for colour mapping
    let peakLo = Infinity, peakHi = -Infinity;
    for (const r of relations) {
      const src = uuidPosMap.get(r.from), dstA = uuidPosMap.get(r.toFrom), dstB = uuidPosMap.get(r.toTo);
      if (!src || !dstA || !dstB) continue;
      const peak = Math.max(minPeakY, Math.sqrt(((dstA.x + dstB.x) / 2 - src.x) ** 2 + ((dstA.z + dstB.z) / 2 - src.z) ** 2) * 0.3);
      if (peak < peakLo) peakLo = peak;
      if (peak > peakHi) peakHi = peak;
    }
    if (!isFinite(peakLo)) peakLo = peakHi = minPeakY;
    const peakSpan = peakHi > peakLo ? peakHi - peakLo : 1;

    // Arc spawn birth times (used for per-arc fade-in)
    const currentArcKeys = new Set(relations.map(r => `${r.from}|${r.toFrom}|${r.toTo}|${r.trad}`));
    for (const key of arcBornTimesRef.current.keys()) {
      if (!currentArcKeys.has(key)) arcBornTimesRef.current.delete(key);
    }
    const now = clockRef.current;
    for (const key of currentArcKeys) {
      if (!arcBornTimesRef.current.has(key)) arcBornTimesRef.current.set(key, now);
    }

    // GPU buffer allocation
    const N    = segs.length;
    const pos  = new Float32Array(N * 4 * 3);
    const dirs = new Float32Array(N * 4 * 3);
    const sid  = new Float32Array(N * 4);
    const col  = new Float32Array(N * 4);
    const prg  = new Float32Array(N * 4);
    const spd  = new Float32Array(N * 4);
    const reli = new Float32Array(N * 4);
    const auth = new Float32Array(N * 4);
    const cath = new Float32Array(N * 4);
    const born = new Float32Array(N * 4);
    const idx  = new Uint32Array(N * 6);

    const hpos = new Float32Array(N * 4 * 3);
    const hidx = new Uint32Array(N * 6);

    for (let i = 0; i < N; i++) {
      const s   = segs[i];
      const t   = (s.arcPeakY - peakLo) / peakSpan;
      const dx  = s.bx - s.ax, dy = s.by - s.ay, dz = s.bz - s.az;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const nx  = dx / len, ny = dy / len, nz = dz / len;
      const px  = -ny, py = nx;
      const b   = i * 4;

      for (let v = 0; v < 4; v++) {
        const isEnd = v >= 2;
        const side  = (v === 0 || v === 3) ? -1 : 1;
        const vi    = b + v;
        pos[vi * 3]     = isEnd ? s.bx : s.ax;
        pos[vi * 3 + 1] = isEnd ? s.by : s.ay;
        pos[vi * 3 + 2] = isEnd ? s.bz : s.az;
        dirs[vi * 3]    = nx; dirs[vi * 3 + 1] = ny; dirs[vi * 3 + 2] = nz;
        sid[vi]  = side;
        col[vi]  = t;
        prg[vi]  = isEnd ? s.t1 : s.t0;
        spd[vi]  = 33.0 / s.arcPeakY;
        reli[vi] = s.relIdx;
        auth[vi] = s.isAuthority ? 1.0 : 0.0;
        cath[vi] = s.isCatholic  ? 1.0 : 0.0;
        const rel    = relations[s.relIdx];
        const arcKey = rel ? `${rel.from}|${rel.toFrom}|${rel.toTo}|${rel.trad}` : '';
        born[vi] = arcBornTimesRef.current.get(arcKey) ?? now;
        const cx = isEnd ? s.bx : s.ax, cy = isEnd ? s.by : s.ay, cz = isEnd ? s.bz : s.az;
        hpos[vi * 3]     = cx + side * px * HIT_W;
        hpos[vi * 3 + 1] = cy + side * py * HIT_W;
        hpos[vi * 3 + 2] = cz;
      }
      const ii = i * 6;
      idx[ii] = b; idx[ii + 1] = b + 1; idx[ii + 2] = b + 2;
      idx[ii + 3] = b; idx[ii + 4] = b + 2; idx[ii + 5] = b + 3;
      hidx[ii] = b; hidx[ii + 1] = b + 1; hidx[ii + 2] = b + 2;
      hidx[ii + 3] = b; hidx[ii + 4] = b + 2; hidx[ii + 5] = b + 3;
    }

    const visualGeo = new THREE.BufferGeometry();
    visualGeo.setAttribute('position',     new THREE.BufferAttribute(pos,  3));
    visualGeo.setAttribute('aDir',         new THREE.BufferAttribute(dirs, 3));
    visualGeo.setAttribute('aSide',        new THREE.BufferAttribute(sid,  1));
    visualGeo.setAttribute('aColorT',      new THREE.BufferAttribute(col,  1));
    visualGeo.setAttribute('aProg',        new THREE.BufferAttribute(prg,  1));
    visualGeo.setAttribute('aArcSpeed',    new THREE.BufferAttribute(spd,  1));
    visualGeo.setAttribute('aRelIdx',      new THREE.BufferAttribute(reli, 1));
    visualGeo.setAttribute('aIsAuthority', new THREE.BufferAttribute(auth, 1));
    visualGeo.setAttribute('aCatholic',    new THREE.BufferAttribute(cath, 1));
    visualGeo.setAttribute('aArcBorn',     new THREE.BufferAttribute(born, 1));
    visualGeo.setIndex(new THREE.BufferAttribute(idx, 1));
    visualGeo.computeBoundingSphere();
    visualGeo.computeBoundingBox();

    const hitGeo = new THREE.BufferGeometry();
    hitGeo.setAttribute('position', new THREE.BufferAttribute(hpos, 3));
    hitGeo.setIndex(new THREE.BufferAttribute(hidx, 1));
    hitGeo.computeBoundingSphere();
    hitGeo.computeBoundingBox();

    // ── Brace circles ────────────────────────────────────────────────────────
    interface BraceInfo {
      barX: number; side: number;
      minY: number; maxY: number;
      relIdx: number; peakT: number;
    }
    const braceInfos: BraceInfo[] = [];
    const lanesForCircles = computeLanes(relations, uuidPosMap);

    for (let ri = 0; ri < relations.length; ri++) {
      const r    = relations[ri];
      if ((r.trad === 'c' && !showCath) || (r.trad === 'p' && !showProt)) continue;
      const src  = uuidPosMap.get(r.from), dstA = uuidPosMap.get(r.toFrom), dstB = uuidPosMap.get(r.toTo);
      if (!src || !dstA || !dstB) continue;
      const lane  = lanesForCircles.get(ri) ?? { toLane: 0, toTotal: 1, fromLane: 0, fromTotal: 1 };
      const peak  = Math.max(minPeakY, Math.sqrt((dstA.x - src.x) ** 2 + (dstA.z - src.z) ** 2) * 0.3);
      const peakT = (peak - peakLo) / peakSpan;

      if (Math.abs(dstA.y - dstB.y) > 0.001) {
        const sideTo = dstA.x < src.x ? 1 : -1;
        braceInfos.push({ barX: dstA.x + sideTo * barOffset(lane.toLane, lane.toTotal), side: sideTo, minY: Math.min(dstA.y, dstB.y), maxY: Math.max(dstA.y, dstB.y), relIdx: ri, peakT });
      }
      const srcEnd = r.fromTo ? uuidPosMap.get(r.fromTo) : null;
      if (srcEnd && Math.abs(srcEnd.y - src.y) > 0.001) {
        const sideFrom = src.x < dstA.x ? 1 : -1;
        braceInfos.push({ barX: src.x + sideFrom * barOffset(lane.fromLane, lane.fromTotal), side: sideFrom, minY: Math.min(src.y, srcEnd.y), maxY: Math.max(src.y, srcEnd.y), relIdx: ri, peakT });
      }
    }

    const circleByBar = new Map<string, BraceInfo[]>();
    for (const bi of braceInfos) {
      const key = bi.barX.toFixed(4);
      if (!circleByBar.has(key)) circleByBar.set(key, []);
      circleByBar.get(key)!.push(bi);
    }

    const circles: BraceCircle[] = [];
    for (const group of circleByBar.values()) {
      const sorted = group
        .map(bi => ({ ...bi, naturalY: bi.minY + (bi.maxY - bi.minY) * 0.25 }))
        .sort((a, b) => a.naturalY - b.naturalY);
      const placedYs: number[] = [];
      for (let i = 0; i < sorted.length; i++) {
        let y = sorted[i].naturalY;
        if (i > 0 && y - placedYs[i - 1] < CIRCLE_SEP) y = placedYs[i - 1] + CIRCLE_SEP;
        y = Math.min(y, (sorted[i].minY + sorted[i].maxY) / 2 - CIRCLE_SEP * 0.5);
        placedYs.push(y);
        circles.push({
          x:      sorted[i].barX,
          y,
          side:   sorted[i].side,
          relIdx: sorted[i].relIdx,
          color:  '#' + gradColor(sorted[i].peakT).getHexString(),
        });
      }
    }

    return { visualGeo, hitGeo, segs, circles, hasAuthority: segs.some(s => s.isAuthority) };
  }, [relations, uuidPosMap, minPeakY, showCath, showProt]); // arcBornTimesRef + clockRef are refs — intentionally not in deps

  useEffect(() => () => { result.visualGeo?.dispose(); result.hitGeo?.dispose(); }, [result]);

  return result;
}
