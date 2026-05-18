import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Html, Line } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useYearMarkersStore } from '@/store/yearMarkers.store';
import type { BibleStructureBook } from '@/models/bible';
import type { BibleTarget } from '@/contexts/BibleDrawerContext.tsx';
import type { LayoutResult, BookLabel } from '@/utils/graphLayout.ts';
import { CUBE_S, V_STEP, CH_STEP, ANIM_DURATION, easeInOutCubic } from '@/utils/graphConstants.ts';

const WARNING_C    = new THREE.Color(0.976, 0.863, 0.361);
const PRIMARY_C    = new THREE.Color('#3BF4FB');
const MID_GRAY_C   = new THREE.Color(0xb8bcc8);
const LIGHT_GRAY_C = new THREE.Color(0xdee0ea);

const GOSPEL_BOOKS = new Set(['Matthieu', 'Marc', 'Luc', 'Jean']);
const LABEL_BRACE_Y  = -2.0;
const BRACE_TICK_H   = 0.8;

/** Props for the {@link Cubes} component. */
interface CubesProps {
  data:               BibleStructureBook[];
  layout:             LayoutResult;
  /** Per-verse colour overrides from the drawer context (e.g. tradition colouring). */
  colorMap:           Map<string, THREE.Color> | null;
  /** Books that have at least one visible relation — their labels are tinted purple. */
  bookHasRelation:    Set<string>;
  hoveredBook:        string | null;
  /** World X coordinates of the arc columns being hovered — cubes in those columns highlight. */
  hoveredArcXs:       Set<number> | null;
  /** X range of a hovered historical period — cubes within the range highlight. */
  hoveredPeriodRange: { startX: number; endX: number } | null;
  /** UUIDs of relation destination verses — highlight target cubes. */
  destUuids:          Set<string>;
  /** Map of UUID → colour hex string for search-result verses. */
  searchHitUuids:     Map<string, string> | null;
  onCubeHover:        (uuid: string | null) => void;
  onCubeClick?:       (uuid: string) => void;
  hideLabels?:        boolean;
}

function BookBrace({ label, hoveredBook, horizontalScale }: { label: BookLabel, hoveredBook: string | null, horizontalScale: number }) {
  const color     = label.name === hoveredBook ? '#F9DC5C' : '#a0a8c8';
  const lineWidth = label.name === hoveredBook ? 3 : 2;
  const halfSpan  = ((label.endX - label.startX) / 2) * horizontalScale;
  const cx        = label.cx * horizontalScale;

  return (
    <group position={[cx, 0, 0]}>
      {label.endX <= label.startX ? (
        <Line points={[[0, LABEL_BRACE_Y + BRACE_TICK_H, 0], [0, LABEL_BRACE_Y, 0]]} color={color} lineWidth={lineWidth} />
      ) : (
        <Line
          points={[
            [-halfSpan, LABEL_BRACE_Y + BRACE_TICK_H, 0],
            [-halfSpan, LABEL_BRACE_Y, 0],
            [ halfSpan, LABEL_BRACE_Y, 0],
            [ halfSpan, LABEL_BRACE_Y + BRACE_TICK_H, 0],
          ]}
          color={color}
          lineWidth={lineWidth}
        />
      )}
    </group>
  );
}

/**
 * Renders every Bible verse as a coloured cube using an `InstancedMesh`.
 */
export function Cubes({
  data, layout, colorMap, bookHasRelation,
  hoveredBook, hoveredArcXs, hoveredPeriodRange,
  destUuids, searchHitUuids,
  onCubeHover, onCubeClick,
  hideLabels = false,
}: CubesProps) {
  const meshRef    = useRef<THREE.InstancedMesh>(null!);
  const { invalidate } = useThree();
  const horizontalScale = useYearMarkersStore(s => s.cameraZoom);
  const invalidateRef  = useRef(invalidate);
  invalidateRef.current = invalidate;

  const hoveredRange = (!hoveredArcXs && hoveredBook)
    ? (hoveredPeriodRange ?? layout.bookLabels.find(b => b.name === hoveredBook) ?? null)
    : null;

  // ── Animation refs ──────────────────────────────────────────────────────
  const prevLayoutRef  = useRef<LayoutResult | null>(null);
  const animStartRef   = useRef<number>(-1);
  const fromLayoutRef  = useRef<LayoutResult | null>(null);
  const labelGroupsRef = useRef<Map<string, THREE.Group>>(new Map());
  const posNeedsSetRef = useRef(true);

  // After every render: hold groups at resting positions when not animating.
  useLayoutEffect(() => {
    if (animStartRef.current >= 0) return;
    const centerXByBook = new Map(layout.bookLabels.map(b => [b.name, b.cx]));
    for (const [name, grp] of labelGroupsRef.current) {
      const x = centerXByBook.get(name); if (x !== undefined) grp.position.x = x * horizontalScale;
    }
  });

  // Detect layout change → start position animation
  useEffect(() => {
    const prev = prevLayoutRef.current;
    prevLayoutRef.current = layout;
    if (!prev) { posNeedsSetRef.current = true; return; }
    const fromCenterX = new Map(prev.bookLabels.map(b => [b.name, b.cx]));
    for (const [name, grp] of labelGroupsRef.current) {
      const x = fromCenterX.get(name); if (x !== undefined) grp.position.x = x * horizontalScale;
    }
    fromLayoutRef.current = prev;
    animStartRef.current  = performance.now();
    invalidateRef.current();
  }, [layout, horizontalScale]);

  // Update cube colours
  useEffect(() => {
    if (!meshRef.current) return;
    let instanceIdx = 0;
    for (const book of data) {
      for (const ch of book.chapters) {
        const uuids = ch.uuids ?? [];
        const count = uuids.length || (ch.verseCount ?? 0);
        for (let v = 0; v < count; v++) {
          const uuid  = uuids[v];
          const pos   = uuid ? layout.uuidPosMap.get(uuid) : undefined;
          const isHovered = pos
            ? hoveredArcXs
              ? hoveredArcXs.has(pos.x)
              : hoveredRange ? pos.x >= hoveredRange.startX - CH_STEP / 2 && pos.x <= hoveredRange.endX + CH_STEP / 2 : false
            : false;
          const isDest   = uuid ? destUuids.has(uuid)                       : false;
          const isSearch = uuid && searchHitUuids ? searchHitUuids.has(uuid) : false;
          const isGospel = GOSPEL_BOOKS.has(book.name);
          const color = (isHovered && !isDest) ? WARNING_C
            : isSearch ? PRIMARY_C
            : (uuid ? colorMap?.get(uuid) : undefined) ?? (isGospel ? new THREE.Color('#826AED') : LIGHT_GRAY_C);
          meshRef.current.setColorAt(instanceIdx++, color);
        }
      }
    }
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    invalidate();
  }, [data, colorMap, hoveredRange, hoveredArcXs, destUuids, searchHitUuids, invalidate, layout.uuidPosMap]);

  // Animate cube + label positions
  useFrame(({ invalidate: inv }) => {
    if (!meshRef.current) return;
    const isAnimating = animStartRef.current >= 0;
    
    const rawT = isAnimating ? (performance.now() - animStartRef.current) / (ANIM_DURATION * 1000) : 1;
    const t    = Math.min(1, rawT);
    if (isAnimating && t >= 1) animStartRef.current = -1;
    
    const eased   = easeInOutCubic(t);
    const fromLayout = isAnimating ? fromLayoutRef.current : null;
    const dummy   = new THREE.Object3D();
    const cubeScaleX = Math.max(1, horizontalScale * 0.9); // Scale thickness with zoom
    let instanceIdx = 0;

    for (const book of data) {
      for (const ch of book.chapters ?? []) {
        const chZ   = layout.chapZMap.get(`${book.number}:${ch.number}`) ?? 0;
        const uuids = ch.uuids ?? [];
        const count = uuids.length || (ch.verseCount ?? 0);
        for (let v = 0; v < count; v++) {
          const uuid = uuids[v];
          const toX  = (uuid ? layout.uuidPosMap.get(uuid)?.x : undefined) ?? 0;
          const fmX  = (fromLayout && uuid ? fromLayout.uuidPosMap.get(uuid)?.x : undefined) ?? toX;
          dummy.position.set((fmX + (toX - fmX) * eased) * horizontalScale, CUBE_S / 2 + v * V_STEP, chZ);
          dummy.scale.set(cubeScaleX, 1, cubeScaleX); // Increase thickness
          dummy.updateMatrix();
          meshRef.current.setMatrixAt(instanceIdx++, dummy.matrix);
        }
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true;

    if (fromLayout) {
      const toCenterX = new Map(layout.bookLabels.map(b => [b.name, b.cx]));
      const fmCenterX = new Map(fromLayout.bookLabels.map(b => [b.name, b.cx]));
      for (const [name, grp] of labelGroupsRef.current) {
        const toX = toCenterX.get(name); if (toX === undefined) continue;
        grp.position.x = ((fmCenterX.get(name) ?? toX) + (toX - (fmCenterX.get(name) ?? toX)) * eased) * horizontalScale;
      }
    } else {
      const centerXByBook = new Map(layout.bookLabels.map(b => [b.name, b.cx]));
      for (const [name, grp] of labelGroupsRef.current) {
        const x = centerXByBook.get(name); if (x !== undefined) grp.position.x = x * horizontalScale;
      }
    }

    if (isAnimating && t < 1) inv();
  });

  const searchHitBooks = useMemo(() => {
    if (!searchHitUuids || searchHitUuids.size === 0) return null;
    const books = new Set<string>();
    for (const uuid of searchHitUuids.keys()) {
      const ref = layout.uuidRefMap.get(uuid);
      if (ref) books.add(ref.book);
    }
    return books;
  }, [searchHitUuids, layout.uuidRefMap]);

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, layout.totalInstances]}
        frustumCulled={false}
        onPointerMove={e => {
          const uuid = e.instanceId != null ? layout.instanceUuids[e.instanceId] : null;
          onCubeHover(uuid ?? null);
          invalidate();
        }}
        onPointerLeave={() => { onCubeHover(null); invalidate(); }}
        onClick={e => {
          if (e.instanceId != null && onCubeClick) {
            onCubeClick(layout.instanceUuids[e.instanceId]);
            e.stopPropagation();
          }
        }}
      >
        <boxGeometry args={[CUBE_S, CUBE_S, CUBE_S]} />
        <meshBasicMaterial />
      </instancedMesh>

      {/* Book name labels */}
      {!hideLabels && layout.bookLabels.map(label => {
        const isGospel  = GOSPEL_BOOKS.has(label.name);
        const isHovered = hoveredBook === label.name;
        const hasRel    = bookHasRelation.has(label.name) || searchHitBooks?.has(label.name);
        const labelStyle: React.CSSProperties = {
          pointerEvents: 'none',
          whiteSpace:    'nowrap',
          fontSize:      '11px',
          fontWeight:    600,
          letterSpacing: '0.3px',
          transform:     'rotate(90deg)',
          transformOrigin: '0 0',
          ...(isGospel ? {
            background:   isHovered ? '#F9DC5C' : 'var(--secondary)',
            color:        isHovered ? '#000'    : '#fff',
            padding:      '2px 7px',
            borderRadius: '4px',
          } : {
            color: isHovered ? '#F9DC5C' : hasRel ? '#C87AFF' : '#dee0ea',
          }),
        };
        return (
          <group key={label.name} ref={r => { if (r) labelGroupsRef.current.set(label.name, r); }}>
            <Html position={[0, -16, 0]} zIndexRange={[0, 0]} style={labelStyle}>
              {label.name}
            </Html>
          </group>
        );
      })}

      {/* Book span braces */}
      {layout.bookLabels.map(label => (
        <BookBrace
          key={`brace_${label.name}`}
          label={label}
          hoveredBook={hoveredBook}
          horizontalScale={horizontalScale}
        />
      ))}
    </>
  );
}
