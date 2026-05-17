import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { BibleRelation } from '@/models/bible';
import type { BibleTarget } from '@/contexts/BibleDrawerContext.tsx';
import type { Pos3 } from '@/utils/graphLayout.ts';
import { computeArcSegments, computeLanes } from '@/utils/graphRelations.ts';
import {
  HIT_PROX, CIRCLE_ZOOM_THRESH,
  ANIM_DURATION, easeInOutCubic,
} from '@/utils/graphConstants.ts';
import { useArcMaterial } from './useArcMaterial.ts';
import { useArcGeometry } from './useArcGeometry.ts';
import { BraceCircles } from './BraceCircles.tsx';

/** Props for the {@link ArcMesh} component. */
interface ArcMeshProps {
  /** Normalised and deduplicated relations to render (both traditions). */
  relations:       BibleRelation[];
  uuidPosMap:      Map<string, Pos3>;
  uuidRefMap:      Map<string, BibleTarget>;
  /** Floor for arc control-point Y (arcs never dip below this value). */
  minPeakY:        number;
  showCath:        boolean;
  showProt:        boolean;
  /** Whether the pulse animation uniform is active. */
  animate:         boolean;
  /** Snapshot of the previous `uuidPosMap` — fed to the arc position animation. */
  fromMapRef:      React.MutableRefObject<Map<string, Pos3> | null>;
  /** `performance.now()` timestamp that started the current arc animation, or −1. */
  arcAnimStartRef: React.MutableRefObject<number>;
  onRelClick:      (targets: BibleTarget[]) => void;
  onArcHover:      (columnXs: Set<number> | null) => void;
  onArcHoverRel:   (rel: BibleRelation | null) => void;
}

/**
 * Renders all Bible-relation arcs as GPU-accelerated wide lines using a custom GLSL shader.
 *
 * Responsibilities:
 * - Delegates geometry + circle computation to {@link useArcGeometry}.
 * - Delegates ShaderMaterial creation to {@link useArcMaterial}.
 * - Animates arc positions when the sort mode changes (tweens from previous layout).
 * - Runs an invisible hit mesh for pointer hover and click detection.
 */
export function ArcMesh({
  relations, uuidPosMap, uuidRefMap, minPeakY,
  showCath, showProt, animate,
  fromMapRef, arcAnimStartRef,
  onRelClick, onArcHover, onArcHoverRel,
}: ArcMeshProps) {
  const arcBornTimesRef = useRef<Map<string, number>>(new Map());
  const clockRef        = useRef(0);
  const hoveredRelRef   = useRef(-1);
  const { invalidate }  = useThree();

  const mat = useArcMaterial(animate);

  const { visualGeo, hitGeo, segs, circles, hasAuthority } = useArcGeometry(
    relations, uuidPosMap, minPeakY, showCath, showProt, arcBornTimesRef, clockRef,
  );

  const [circlesVisible, setCirclesVisible] = useState(false);

  // Arc position animation buffers
  const lastArcAnimStart = useRef<number>(-1);
  const fromPosBuf       = useRef<Float32Array | null>(null);
  const toPosBuf         = useRef<Float32Array | null>(null);
  const fromDirBuf       = useRef<Float32Array | null>(null);
  const toDirBuf         = useRef<Float32Array | null>(null);

  useEffect(() => {
    if (relations.length > 0) invalidate();
  }, [relations, invalidate]);

  // Snapshot canonical TO positions when new geometry is produced
  useEffect(() => {
    if (!visualGeo) return;
    toPosBuf.current = new Float32Array(visualGeo.attributes.position.array as Float32Array);
    toDirBuf.current = new Float32Array(visualGeo.attributes.aDir.array as Float32Array);
  }, [visualGeo]);

  // ── Relation click handler ────────────────────────────────────────────────
  const handleRelClick = useCallback((relIndex: number) => {
    if (relIndex < 0) return;
    const rel = relations[relIndex];
    if (!rel) return;
    const fromRef   = uuidRefMap.get(rel.from);
    const toFromRef = uuidRefMap.get(rel.toFrom);
    const toToRef   = uuidRefMap.get(rel.toTo);
    if (!fromRef || !toFromRef) return;

    const fromColX  = uuidPosMap.get(rel.from)?.x;
    const verseNums = new Set<number>([fromRef.verse!]);
    for (const r of relations) {
      if (r.toFrom !== rel.toFrom || r.toTo !== rel.toTo || r.trad !== rel.trad) continue;
      const pos = uuidPosMap.get(r.from);
      if (!pos || pos.x !== fromColX) continue;
      const ref = uuidRefMap.get(r.from);
      if (ref?.verse != null) verseNums.add(ref.verse);
    }

    const sortedVerses = [...verseNums].sort((a, b) => a - b);
    const centerIdx    = sortedVerses.indexOf(fromRef.verse!);
    let rangeStart = centerIdx, rangeEnd = centerIdx;
    while (rangeStart > 0 && sortedVerses[rangeStart - 1] === sortedVerses[rangeStart] - 1) rangeStart--;
    while (rangeEnd < sortedVerses.length - 1 && sortedVerses[rangeEnd + 1] === sortedVerses[rangeEnd] + 1) rangeEnd++;

    const fromTarget: BibleTarget = {
      book:    fromRef.book,
      chapter: fromRef.chapter,
      verse:   sortedVerses[rangeStart],
      ...(sortedVerses[rangeEnd] !== sortedVerses[rangeStart] ? { verseTo: sortedVerses[rangeEnd] } : {}),
    };
    const toTarget: BibleTarget = toToRef && toToRef.verse !== toFromRef.verse
      ? { book: toFromRef.book, chapter: toFromRef.chapter, verse: toFromRef.verse, verseTo: toToRef.verse }
      : { ...toFromRef };

    onRelClick([fromTarget, toTarget]);
  }, [relations, uuidPosMap, uuidRefMap, onRelClick]);

  // ── Frame loop: uniforms + arc position animation ─────────────────────────
  useFrame(({ size, camera, clock, invalidate: inv }) => {
    const zoom = (camera as THREE.OrthographicCamera).zoom;
    mat.uniforms.uResolution.value.set(size.width, size.height);
    mat.uniforms.uHoveredRel.value = hoveredRelRef.current;
    mat.uniforms.uZoomT.value = Math.min(1, Math.max(0, (Math.log(zoom) - Math.log(4)) / (Math.log(60) - Math.log(4))));

    const onTop = zoom > 8;
    if (mat.depthTest === onTop) { mat.depthTest = !onTop; mat.needsUpdate = true; inv(); }

    const showCircles = zoom >= CIRCLE_ZOOM_THRESH;
    setCirclesVisible(prev => prev === showCircles ? prev : showCircles);

    const elapsed = clock.getElapsedTime();
    clockRef.current = elapsed;
    mat.uniforms.uTime.value = elapsed;

    const animDur      = mat.uniforms.uAnimDur.value as number;
    const hasSpawnAnim = arcBornTimesRef.current.size > 0 &&
      [...arcBornTimesRef.current.values()].some(born => (elapsed - born) < animDur);
    if (animate || hasAuthority || hasSpawnAnim) inv();

    // Arc position tween (on book sort-mode change)
    const arcStart = arcAnimStartRef.current;
    if (arcStart >= 0 && visualGeo) {
      if (arcStart !== lastArcAnimStart.current) {
        lastArcAnimStart.current = arcStart;
        const fromMap = fromMapRef.current;
        if (fromMap && toPosBuf.current) {
          const fromLanes = computeLanes(relations, fromMap);
          const fromCath  = showCath ? computeArcSegments(relations, fromMap, minPeakY, 'c', fromLanes) : [];
          const fromProt  = showProt ? computeArcSegments(relations, fromMap, minPeakY, 'p', fromLanes) : [];
          const fromSegs  = fromCath.concat(fromProt);
          // Must match the sort used in useArcGeometry so segment i in fromSegs
          // corresponds to segment i in toPosBuf (and segs).
          fromSegs.sort((a, b) => ((a.isAuthority ? 2 : 0) + (a.isCatholic ? 1 : 0)) - ((b.isAuthority ? 2 : 0) + (b.isCatholic ? 1 : 0)));
          if (fromSegs.length === segs.length) {
            const M  = fromSegs.length;
            const fp = new Float32Array(M * 4 * 3);
            const fd = new Float32Array(M * 4 * 3);
            for (let i = 0; i < M; i++) {
              const s   = fromSegs[i];
              const dx  = s.bx - s.ax, dy = s.by - s.ay, dz = s.bz - s.az;
              const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
              const nx  = dx / len, ny = dy / len, nz = dz / len;
              for (let v = 0; v < 4; v++) {
                const isEnd = v >= 2;
                const vi    = i * 4 + v;
                fp[vi * 3]     = isEnd ? s.bx : s.ax;
                fp[vi * 3 + 1] = isEnd ? s.by : s.ay;
                fp[vi * 3 + 2] = isEnd ? s.bz : s.az;
                fd[vi * 3]     = nx; fd[vi * 3 + 1] = ny; fd[vi * 3 + 2] = nz;
              }
            }
            fromPosBuf.current = fp;
            fromDirBuf.current = fd;
          } else {
            arcAnimStartRef.current = -1;
          }
        } else {
          arcAnimStartRef.current = -1;
        }
      }

      if (arcAnimStartRef.current >= 0 && fromPosBuf.current && toPosBuf.current) {
        const rawT    = (performance.now() - arcStart) / (ANIM_DURATION * 1000);
        const t       = Math.min(1, rawT);
        const eased   = easeInOutCubic(t);
        const posAttr = visualGeo.attributes.position.array as Float32Array;
        const dirAttr = visualGeo.attributes.aDir.array as Float32Array;
        const fp = fromPosBuf.current, tp = toPosBuf.current;
        const fd = fromDirBuf.current!, td = toDirBuf.current!;
        if (posAttr.length === fp.length && posAttr.length === tp.length) {
          for (let i = 0; i < posAttr.length; i++) posAttr[i] = fp[i] + (tp[i] - fp[i]) * eased;
          for (let i = 0; i < dirAttr.length; i++) dirAttr[i] = fd[i] + (td[i] - fd[i]) * eased;
          visualGeo.attributes.position.needsUpdate = true;
          visualGeo.attributes.aDir.needsUpdate     = true;
          inv();
        } else {
          // Size mismatch (geometry changed mid-animation) — snap to final positions
          posAttr.set(tp);
          dirAttr.set(td);
          visualGeo.attributes.position.needsUpdate = true;
          visualGeo.attributes.aDir.needsUpdate     = true;
          inv();
        }
        if (t >= 1) {
          arcAnimStartRef.current = -1;
          fromPosBuf.current      = null;
          fromDirBuf.current      = null;
        }
      }
    }
  });

  if (!visualGeo || !hitGeo) return null;

  return (
    <>
      <mesh geometry={visualGeo} material={mat} frustumCulled={false} />

      <BraceCircles circles={circles} visible={circlesVisible} onRelClick={handleRelClick} />

      <mesh
        geometry={hitGeo}
        frustumCulled={false}
        onPointerMove={e => {
          const px = e.point.x, py = e.point.y;
          let closestRelIdx = -1, closestDist = Infinity;
          for (const seg of segs) {
            const dx   = seg.bx - seg.ax, dy = seg.by - seg.ay;
            const len2 = dx * dx + dy * dy;
            if (len2 < 1e-10) continue;
            const t  = Math.max(0, Math.min(1, ((px - seg.ax) * dx + (py - seg.ay) * dy) / len2));
            const cx = seg.ax + t * dx, cy = seg.ay + t * dy;
            const d  = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
            if (d < HIT_PROX && d < closestDist) { closestDist = d; closestRelIdx = seg.relIdx; }
          }
          if (hoveredRelRef.current === closestRelIdx) return;
          hoveredRelRef.current = closestRelIdx;
          if (closestRelIdx >= 0) {
            const rel = relations[closestRelIdx];
            const src = uuidPosMap.get(rel.from), dstA = uuidPosMap.get(rel.toFrom), dstB = uuidPosMap.get(rel.toTo);
            const xs  = new Set<number>();
            if (src)  xs.add(src.x);
            if (dstA) xs.add(dstA.x);
            if (dstB) xs.add(dstB.x);
            onArcHover(xs.size > 0 ? xs : null);
            onArcHoverRel(rel);
          } else {
            onArcHover(null);
            onArcHoverRel(null);
          }
          invalidate();
        }}
        onPointerLeave={() => {
          hoveredRelRef.current = -1;
          onArcHover(null);
          onArcHoverRel(null);
          invalidate();
        }}
        onClick={e => { e.stopPropagation(); handleRelClick(hoveredRelRef.current); }}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}
