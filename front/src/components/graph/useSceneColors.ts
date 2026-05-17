import { useMemo } from 'react';
import * as THREE from 'three';
import type { BibleRelation } from '@/models/bible';
import type { LayoutResult } from '@/models/graph';

const MID_GRAY_C   = new THREE.Color(0xb8bcc8);
const LIGHT_GRAY_C = new THREE.Color(0xdee0ea);

function gradColorForPeak(t: number): THREE.Color {
  const w = new THREE.Color(0.976, 0.863, 0.361);
  const p = new THREE.Color(0.231, 0.957, 0.984);
  const s = new THREE.Color(0.784, 0.475, 1.0);
  return t < 0.5 ? w.lerp(p, t * 2) : p.lerp(s, (t - 0.5) * 2);
}

export interface SceneColors {
  colorMap:        Map<string, THREE.Color>;
  bookHasRelation: Set<string>;
  destUuids:       Set<string>;
}

export function useSceneColors(
  layout:           LayoutResult | null,
  displayRelations: BibleRelation[] | null,
  showCath:         boolean,
  showProt:         boolean,
): SceneColors | null {
  return useMemo(() => {
    if (!layout || !displayRelations) return null;
    const minPeakY = layout.maxTowerY * 0.5;

    let peakLo = Infinity, peakHi = -Infinity;
    for (const r of displayRelations) {
      if ((r.trad === 'c' && !showCath) || (r.trad === 'p' && !showProt)) continue;
      const src  = layout.uuidPosMap.get(r.from);
      const dstA = layout.uuidPosMap.get(r.toFrom);
      const dstB = layout.uuidPosMap.get(r.toTo);
      if (!src || !dstA || !dstB) continue;
      const peak = Math.max(minPeakY, Math.sqrt((dstA.x - src.x) ** 2 + (dstA.z - src.z) ** 2) * 0.3);
      if (peak < peakLo) peakLo = peak;
      if (peak > peakHi) peakHi = peak;
    }
    if (!isFinite(peakLo)) peakLo = peakHi = minPeakY;
    const peakSpan = peakHi > peakLo ? peakHi - peakLo : 1;

    const relatedColumns = new Set<number>();
    const destColors     = new Map<string, THREE.Color>();

    for (const r of displayRelations) {
      if ((r.trad === 'c' && !showCath) || (r.trad === 'p' && !showProt)) continue;
      const src  = layout.uuidPosMap.get(r.from);
      const dstA = layout.uuidPosMap.get(r.toFrom);
      const dstB = layout.uuidPosMap.get(r.toTo);
      if (!src || !dstA || !dstB) continue;
      relatedColumns.add(src.x); relatedColumns.add(dstA.x); relatedColumns.add(dstB.x);
      const peak  = Math.max(minPeakY, Math.sqrt((dstA.x - src.x) ** 2 + (dstA.z - src.z) ** 2) * 0.3);
      const color = gradColorForPeak((peak - peakLo) / peakSpan);

      const colorVerseRange = (colX: number, yA: number, yB: number) => {
        const lo = Math.min(yA, yB), hi = Math.max(yA, yB);
        for (const [uuid, pos] of layout.uuidPosMap) {
          if (Math.abs(pos.x - colX) < 0.001 && pos.y >= lo - 0.001 && pos.y <= hi + 0.001) {
            if (!destColors.has(uuid)) destColors.set(uuid, color);
          }
        }
      };
      colorVerseRange(dstA.x, dstA.y, dstB.y);
      const srcEnd = r.fromTo ? layout.uuidPosMap.get(r.fromTo) : null;
      if (srcEnd) colorVerseRange(src.x, src.y, srcEnd.y);
    }

    const bookHasRelation = new Set<string>();
    for (const book of layout.bookLabels) {
      for (const colX of relatedColumns) {
        if (colX >= book.startX - 0.001 && colX <= book.endX + 0.001) { bookHasRelation.add(book.name); break; }
      }
    }

    const inRelatedBook = (() => {
      const cache = new Map<number, boolean>();
      return (x: number): boolean => {
        if (cache.has(x)) return cache.get(x)!;
        const result = layout.bookLabels.some(b => bookHasRelation.has(b.name) && x >= b.startX - 0.001 && x <= b.endX + 0.001);
        cache.set(x, result);
        return result;
      };
    })();

    const colorMap = new Map<string, THREE.Color>();
    for (const uuid of layout.instanceUuids) {
      const pos = layout.uuidPosMap.get(uuid);
      colorMap.set(uuid, destColors.get(uuid) ?? (pos && inRelatedBook(pos.x) ? MID_GRAY_C : LIGHT_GRAY_C));
    }

    return { colorMap, bookHasRelation, destUuids: new Set(destColors.keys()) };
  }, [layout, displayRelations, showCath, showProt]);
}
