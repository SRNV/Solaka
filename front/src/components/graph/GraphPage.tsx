import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { usePaginatedAllApi } from '@/hooks/usePaginatedAllApi.ts';
import { useStompRelations } from '@/hooks/useStompRelations.ts';
import { useStompSearch } from '@/hooks/useStompSearch.ts';
import { bibleStore } from '@/store/bible.store.ts';
import type {
  BibleBookMeta, BibleBookOrder, BibleEvent,
  BibleRelation, BibleStructureBook, BookSortMode,
  HistoricalPeriod, HistoricalSubMode, King,
} from '@/types/bible.ts';
import { useBibleDrawer, type BibleTarget } from '@/contexts/BibleDrawerContext.tsx';
import { parseRef } from '@/utils/bibleRef.ts';
import { computeLayout, type LayoutResult } from '@/utils/graphLayout.ts';
import { normalizeRelations, mergeRelationIncremental } from '@/utils/graphRelations.ts';
import { useRelationsStore, relsFetched } from '@/store/relations.store.ts';
import { V_STEP } from '@/utils/graphConstants.ts';
import { ArcMesh } from './ArcMesh.tsx';
import { Cubes } from './Cubes.tsx';
import { CommentSquaresMesh } from './CommentSquaresMesh.tsx';
import { usePatristicCommentIndex } from '@/hooks/useCommentIndex.ts';
import { HoverPlane } from './HoverPlane.tsx';
import { SectionMarkers } from './SectionMarkers.tsx';
import { SearchInput } from './SearchInput.tsx';
import { CameraReporter, FitCamera, LockCameraY } from './CameraHelpers.tsx';
import { HoverPanel } from './HoverPanel.tsx';
import { TraditionModal } from './TraditionModal.tsx';
import type { PanelData } from './HoverPanel.tsx';
import { BibleMap } from '@/lib/BibleMap/index.ts';
import styles from './GraphPage.module.css';

// ── Colour constants used for sceneColors computation ─────────────────────
const MID_GRAY_C   = new THREE.Color(0xb8bcc8);
const LIGHT_GRAY_C = new THREE.Color(0xdee0ea);

function gradColorForPeak(t: number): THREE.Color {
  const w = new THREE.Color(0.976, 0.863, 0.361);
  const p = new THREE.Color(0.231, 0.957, 0.984);
  const s = new THREE.Color(0.784, 0.475, 1.0);
  return t < 0.5 ? w.lerp(p, t * 2) : p.lerp(s, (t - 0.5) * 2);
}

const SORT_LABELS: Record<BookSortMode, string> = {
  classic:    'Classique',
  historical: 'Historique',
  size:       'Taille',
};

const HIST_SUB_LABELS: Record<HistoricalSubMode, string> = {
  authorPeriod:    'Période auteur',
  mainComposition: 'Composition',
  finalRedaction:  'Rédaction finale',
};

function normText(s: string): string {
  return s
    .toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[''ʼ]/g, "'")
    .replace(/\s+/g, ' ').trim();
}


// ── GraphPage ─────────────────────────────────────────────────────────────

export function GraphPage() {
  usePatristicCommentIndex();

  // ── Tradition + display toggles ─────────────────────────────────────────
  const [showCath,    setShowCath]    = useState(true);
  const [showProt,    setShowProt]    = useState(false);
  const [showPulse,   setShowPulse]   = useState(false);
  const [sortMode,    setSortMode]    = useState<BookSortMode>('classic');
  const [histSubMode, setHistSubMode] = useState<HistoricalSubMode>('authorPeriod');
  const [histSecondaryFrise, setHistSecondaryFrise] = useState<'kings' | 'periods' | 'events'>('kings');
  const [tradConfirm, setTradConfirm] = useState<{ traditions: string[]; onConfirm: () => void } | null>(null);

  // Refs so async callbacks don't go stale
  const showCathRef = useRef(showCath);
  const showProtRef = useRef(showProt);
  showCathRef.current = showCath;
  showProtRef.current = showProt;

  // ── Data fetching ──────────────────────────────────────────────────────
  const { data: structData,  loading: sLoading } = usePaginatedAllApi<BibleStructureBook>('/api/bible/structure');
  const { data: orderData,   loading: oLoading }  = usePaginatedAllApi<BibleBookOrder>('/api/bible/book-order');
  const { data: metaData,    loading: mLoading }  = usePaginatedAllApi<BibleBookMeta>('/api/bible/books');
  const [kingsData,   setKingsData]   = useState<King[] | null>(null);
  const [periodsData, setPeriodsData] = useState<HistoricalPeriod[] | null>(null);
  const [eventsData,  setEventsData]  = useState<BibleEvent[] | null>(null);

  const loading       = sLoading || oLoading || mLoading;
  const bookOrderData = orderData;
  const books         = metaData;

  // ── Sort mode ──────────────────────────────────────────────────────────
  const handleSortMode = useCallback((mode: BookSortMode) => {
    if (mode === sortMode) return;
    setSortMode(mode);
    if (mode === 'historical') {
      if (!eventsData)  bibleStore.events().then(setEventsData);
      if (!kingsData)   bibleStore.kings().then(setKingsData);
      if (!periodsData) bibleStore.periods().then(setPeriodsData);
    }
  }, [sortMode, eventsData, kingsData, periodsData]);

  const handleHistSubMode = useCallback((sub: HistoricalSubMode) => {
    if (sub !== histSubMode) setHistSubMode(sub);
  }, [histSubMode]);

  // ── Drawer + interaction ───────────────────────────────────────────────
  const { open, openMany, close, showInMapCount, mapTargets, target, targets, setHistoricalDate } = useBibleDrawer();
  const [hoveredBook,        setHoveredBook]        = useState<string | null>(null);
  const [drawerRelations,    setDrawerRelations]    = useState<BibleRelation[] | null>(null);
  const [hoveredArcXs,       setHoveredArcXs]       = useState<Set<number> | null>(null);
  const [hoveredRel,         setHoveredRel]         = useState<BibleRelation | null>(null);
  const [hoveredVerses,      setHoveredVerses]      = useState<{ from: string; fromSummary: string; to: string; toSummary: string } | null>(null);
  const [hoveredCubeUuid,    setHoveredCubeUuid]    = useState<string | null>(null);
  const [hoveredCubeVerse,   setHoveredCubeVerse]   = useState<string | null>(null);
  const [hoveredCubeSummary, setHoveredCubeSummary] = useState<string | null>(null);
  const [panelData,          setPanelData]          = useState<PanelData | null>(null);

  const effectiveHoveredBook = hoveredArcXs ? null : hoveredBook;

  // ── Relations (STOMP) ──────────────────────────────────────────────────
  // Start disabled: the submittedQuery or showInMapCount effects enable it explicitly.
  // Starting as true would cause useStompRelations to subscribe to all relations on mount
  // (empty query = no filter), which is both expensive and wrong.
  const [relationsEnabled,    setRelationsEnabled]    = useState(false);
  const [activeRelationsQuery, setActiveRelationsQuery] = useState('');

  const loadRefRelations = useCallback((t: BibleTarget, cath: boolean, prot: boolean) => {
    setShowCath(cath);
    setShowProt(prot);
    const v = t.verse != null ? ` ${t.verse}${t.verseTo && t.verseTo !== t.verse ? `–${t.verseTo}` : ''}` : '';
    setActiveRelationsQuery(`${t.book} ${t.chapter}${v}`);
    setRelationsEnabled(true);
  }, []);

  const { relations: stompRelations } = useStompRelations(relationsEnabled, showCath, showProt, activeRelationsQuery);

  // ── Text search (STOMP) ────────────────────────────────────────────────
  const [textSearchQuery, setTextSearchQuery] = useState('');
  const { results: stompSearchResults }       = useStompSearch(textSearchQuery);
  const textExtraTermsRef                     = useRef<string[]>([]);

  // ── Layout ────────────────────────────────────────────────────────────
  const sortedData = useMemo<BibleStructureBook[] | null>(() => {
    if (!structData) return null;
    if (sortMode === 'classic') return structData;
    const arr = [...structData];
    if (sortMode === 'historical' && bookOrderData) {
      const dateMap = new Map(bookOrderData.map(b => [b.number, b[histSubMode][0]]));
      arr.sort((a, b) => (dateMap.get(a.number) ?? 9999) - (dateMap.get(b.number) ?? 9999));
    } else if (sortMode === 'size') {
      arr.sort((a, b) => {
        const countA = (a.chapters ?? []).reduce((s, ch) => s + (ch?.verseCount ?? 0), 0);
        const countB = (b.chapters ?? []).reduce((s, ch) => s + (ch?.verseCount ?? 0), 0);
        return countB - countA;
      });
    }
    return arr;
  }, [structData, sortMode, histSubMode, bookOrderData]);

  const layout = useMemo(
    () => (Array.isArray(sortedData) && sortedData.length > 0 ? computeLayout(sortedData) : null),
    [sortedData],
  );

  // Stable initial camera centre — prevents jumps when relations stream in
  const initialCxRef = useRef<number | null>(null);
  if (layout && initialCxRef.current === null) initialCxRef.current = layout.totalX / 2;
  const stableCx = initialCxRef.current ?? 0;

  const mainCamRef = useRef({ x: stableCx, zoom: 1 });

  // ── Merge + normalise relations ────────────────────────────────────────
  // stompRelations grows one element per 250 ms tick. Instead of re-running
  // normalizeRelations on the full list each time (O(n²) total), we maintain
  // an incrementally-merged state so braces build up progressively.
  const [mergedStompRels, setMergedStompRels] = useState<BibleRelation[]>([]);
  const prevStompLenRef = useRef(0);
  const prevMergedRef   = useRef<BibleRelation[]>([]);
  const prevLayoutRef   = useRef<typeof layout | null>(null);

  useEffect(() => {
    const cur          = stompRelations ?? [];
    const posMap       = layout?.uuidPosMap;
    const layoutChanged = layout !== prevLayoutRef.current;
    prevLayoutRef.current = layout;

    if (cur.length === 0 || !posMap) {
      prevStompLenRef.current = 0;
      prevMergedRef.current   = [];
      setMergedStompRels([]);
      return;
    }

    if (layoutChanged || cur.length < prevStompLenRef.current) {
      // Layout changed or stream reset — full re-normalization with new positions
      const fresh = normalizeRelations(cur, posMap);
      prevStompLenRef.current = cur.length;
      prevMergedRef.current   = fresh;
      setMergedStompRels(fresh);
      return;
    }

    // Incremental: fold only the newly arrived relations
    let current = prevMergedRef.current;
    for (let i = prevStompLenRef.current; i < cur.length; i++) {
      current = mergeRelationIncremental(current, cur[i], posMap);
    }
    prevStompLenRef.current = cur.length;
    prevMergedRef.current   = current;
    setMergedStompRels(current);
  }, [stompRelations, layout]);

  // Gate: when STOMP is loading but hasn't delivered anything yet (stream just reset),
  // stompRelations.length === 0, so we discard stale mergedStompRels from the previous
  // query immediately — same render cycle as the hook reset, no one-frame arc bleed.
  const displayRelations = useMemo<BibleRelation[] | null>(() => {
    if (!layout) return null;
    const activeStompRels = stompRelations.length > 0 ? mergedStompRels : [];
    const combined = [...(drawerRelations ?? []), ...activeStompRels];
    if (combined.length === 0) return null;
    if (!drawerRelations?.length) return activeStompRels.length > 0 ? activeStompRels : null;
    return normalizeRelations(combined, layout.uuidPosMap);
  }, [drawerRelations, mergedStompRels, stompRelations, layout]);

  // ── Scene colours ─────────────────────────────────────────────────────
  const sceneColors = useMemo(() => {
    if (!layout || !displayRelations) return null;
    const minPeakY = layout.maxTowerY * 0.5;

    let peakLo = Infinity, peakHi = -Infinity;
    for (const r of displayRelations) {
      if ((r.trad === 'c' && !showCath) || (r.trad === 'p' && !showProt)) continue;
      const src = layout.uuidPosMap.get(r.from), dstA = layout.uuidPosMap.get(r.toFrom), dstB = layout.uuidPosMap.get(r.toTo);
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
      const src = layout.uuidPosMap.get(r.from), dstA = layout.uuidPosMap.get(r.toFrom), dstB = layout.uuidPosMap.get(r.toTo);
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

  // ── Authority UUID set (for badge styling) ─────────────────────────────
  const authorityUuids = useMemo(() => {
    const uuids = new Set<string>();
    for (const r of [...(stompRelations ?? []), ...(drawerRelations ?? [])]) {
      if ((r.relType ?? (r as any).relation_type) === 'authority') {
        uuids.add(r.from); uuids.add(r.toFrom); uuids.add(r.toTo);
      }
    }
    return uuids;
  }, [stompRelations, drawerRelations]);

  // ── Search ─────────────────────────────────────────────────────────────
  const [submittedQuery,  setSubmittedQuery]  = useState('');
  const [searchHitUuids,  setSearchHitUuids]  = useState<Map<string, string> | null>(null);
  const [activeSearchRef, setActiveSearchRef] = useState<ReturnType<typeof parseRef> | null>(null);

  useEffect(() => {
    const query = submittedQuery.trim();
    setSearchHitUuids(null);
    setActiveSearchRef(null);
    setDrawerRelations(null);
    setActiveRelationsQuery('');

    if (query.length < 2) {
      setTextSearchQuery('');
      textExtraTermsRef.current = [];
      setRelationsEnabled(false);
      return;
    }

    const parts = query.split(';').map(p => p.trim()).filter(p => p.length > 0);
    const ref   = books ? parseRef(parts[0], books) : null;
    if (ref) setActiveSearchRef(ref);

    // Lightweight REST hit endpoint for immediate verse highlights
    fetch(`/api/bible/search/hits?q=${encodeURIComponent(parts[0])}`)
      .then(r => r.json())
      .then(res => {
        const hits = new Map<string, string>(
          (res.data as Array<{ uuid: string; relType: string }>).map(h => [h.uuid, h.relType]),
        );
        startTransition(() => setSearchHitUuids(hits));
      });

    const terms = parts.map(p => normText(p));
    textExtraTermsRef.current = terms.slice(1);
    setTextSearchQuery(parts[0]);

    const hasRef = parts.some(p => !!(books && parseRef(p, books)));
    if (hasRef) {
      setActiveRelationsQuery(parts[0]);
      setRelationsEnabled(true);
    } else {
      setActiveRelationsQuery('');
      setRelationsEnabled(false);
    }
  }, [submittedQuery, books]); // layout intentionally omitted — search doesn't depend on layout

  // Merge streaming STOMP search results into searchHitUuids
  useEffect(() => {
    if (stompSearchResults.length === 0) return;
    const extras   = textExtraTermsRef.current;
    const filtered = extras.length === 0
      ? stompSearchResults
      : stompSearchResults.filter(r => { const nv = normText(r.content); return extras.every(t => nv.includes(t)); });
    if (filtered.length === 0) return;
    startTransition(() =>
      setSearchHitUuids(prev => {
        const next = new Map(prev);
        for (const r of filtered) next.set(r.uuid, '');
        return next;
      }),
    );
  }, [stompSearchResults]);

  // ── Search badges ──────────────────────────────────────────────────────
  const searchBadges = useMemo(() => {
    if (!searchHitUuids || !layout) return [];
    const badges: { uuid: string; book: string; chapter: number; verseStart: number; verseEnd: number; x: number; y: number; isAuthority: boolean; label: string }[] = [];
    const hitsByX = new Map<number, string[]>();
    for (const uuid of searchHitUuids.keys()) {
      const pos = layout.uuidPosMap.get(uuid);
      if (pos) { if (!hitsByX.has(pos.x)) hitsByX.set(pos.x, []); hitsByX.get(pos.x)!.push(uuid); }
    }
    for (const [x, uuids] of hitsByX) {
      uuids.sort((a, b) => (layout.uuidPosMap.get(a)?.y ?? 0) - (layout.uuidPosMap.get(b)?.y ?? 0));
      let rangeStart = 0;
      for (let i = 1; i <= uuids.length; i++) {
        const prevPos = layout.uuidPosMap.get(uuids[i - 1]);
        const currPos = i < uuids.length ? layout.uuidPosMap.get(uuids[i]) : null;
        if (!currPos || Math.abs(currPos.y - prevPos!.y - V_STEP) > 0.001) {
          const range    = uuids.slice(rangeStart, i);
          const topPos   = layout.uuidPosMap.get(range[range.length - 1])!;
          const refStart = layout.uuidRefMap.get(range[0])!;
          const refEnd   = layout.uuidRefMap.get(range[range.length - 1])!;
          badges.push({
            uuid:        range[0],
            book:        refStart.book,
            chapter:     refStart.chapter,
            verseStart:  refStart.verse!,
            verseEnd:    refEnd.verse!,
            x,
            y:           topPos.y + V_STEP,
            isAuthority: range.some(u => authorityUuids.has(u)),
            label:       range.length > 1
              ? `${refStart.book.slice(0, 3)}. ${refStart.chapter}:${refStart.verse}–${refEnd.verse}`
              : `${refStart.book.slice(0, 3)}. ${refStart.chapter}:${refStart.verse}`,
          });
          rangeStart = i;
        }
      }
    }
    return badges;
  }, [searchHitUuids, layout, authorityUuids]);

  // ── Arc position animation tracking ────────────────────────────────────
  const arcFromMapRef    = useRef<Map<string, ReturnType<LayoutResult['uuidPosMap']['get']> & object> | null>(null) as React.MutableRefObject<Map<string, { x: number; y: number; z: number }> | null>;
  const arcAnimStartRef  = useRef<number>(-1);
  const prevArcLayoutRef = useRef<LayoutResult | null>(null);

  useEffect(() => {
    if (!layout) return;
    const prev = prevArcLayoutRef.current;
    prevArcLayoutRef.current = layout;
    if (prev && prev !== layout) {
      arcFromMapRef.current   = prev.uuidPosMap;
      arcAnimStartRef.current = performance.now();
    }
  }, [layout]);

  // ── Drawer → map relations ─────────────────────────────────────────────
  // NOTE: layout is intentionally NOT guarded here. Removing the !layout guard
  // fixes the case where the user navigates from the drawer to a fresh graph page:
  // layout is null on first render, so guarding on it would make the effect exit
  // early and never retry (layout is not in deps). The q string doesn't need layout.
  //
  // Store-cache path: verse relations fetched by the drawer (useVerseRelations) are
  // cached in useRelationsStore. When "show in map" fires, we pull all cached relations
  // for the target book+chapter and set them immediately as drawerRelations so braces
  // appear without waiting for the STOMP stream to re-fetch them one by one.
  const lastShowInMapCount = useRef(0);
  const layoutRef = useRef<typeof layout>(null);
  layoutRef.current = layout;

  useEffect(() => {
    if (showInMapCount === 0 || showInMapCount === lastShowInMapCount.current) return;
    lastShowInMapCount.current = showInMapCount;
    const activeTargets = mapTargets ?? (targets.length > 0 ? targets : target ? [target] : []);
    if (!activeTargets.length) return;

    setDrawerRelations(null); // clear stale data before loading new

    // Read cached verse relations from the store for all target book+chapter combos
    const currentLayout = layoutRef.current;
    if (currentLayout) {
      const storeState = useRelationsStore.getState();
      const fromStore: BibleRelation[] = [];
      const targetKeys = new Set(activeTargets.map(t => `${t.book}|${t.chapter}`));

      for (const [uuid, ref] of currentLayout.uuidRefMap) {
        if (!targetKeys.has(`${ref.book}|${ref.chapter}`)) continue;
        if (!relsFetched.has(uuid)) continue;
        for (const key of (storeState.byFrom[uuid] ?? [])) {
          const row = storeState.rels[key];
          if (!row) continue;
          fromStore.push({ from: row.from, toFrom: row.toFrom, toTo: row.toTo, trad: row.trad, relType: row.relType });
        }
      }
      if (fromStore.length > 0) setDrawerRelations(fromStore);
    }

    const q = activeTargets.map(t => {
      const v = t.verse != null ? ` ${t.verse}${t.verseTo && t.verseTo !== t.verse ? `–${t.verseTo}` : ''}` : '';
      return `${t.book} ${t.chapter}${v}`;
    }).join(';');
    setActiveRelationsQuery(q);
    setRelationsEnabled(true);
  }, [showInMapCount, mapTargets]); // targets/target intentionally read from closure at trigger time

  // ── Historical date on hover ────────────────────────────────────────────
  useEffect(() => {
    if (target || sortMode !== 'historical' || !effectiveHoveredBook || !bookOrderData) return;
    const entry = bookOrderData.find(b => b.name === effectiveHoveredBook);
    if (!entry) return;
    const range = entry[histSubMode] as [number, number];
    setHistoricalDate(range[0]);
  }, [effectiveHoveredBook, sortMode, bookOrderData, histSubMode, setHistoricalDate, target]);

  useEffect(() => {
    if (sortMode === 'historical' && target && bookOrderData) {
      const book = bookOrderData.find(b => b.name === target.book);
      if (book?.[histSubMode]) setHistoricalDate(book[histSubMode]![0]);
    } else {
      setHistoricalDate(null);
    }
  }, [target, bookOrderData, histSubMode, setHistoricalDate, sortMode]);

  // ── Hover panel data ───────────────────────────────────────────────────
  useEffect(() => {
    if (!hoveredRel || !layout) { setHoveredVerses(null); return; }
    const fromRef = layout.uuidRefMap.get(hoveredRel.from);
    const toRef   = layout.uuidRefMap.get(hoveredRel.toFrom);
    if (!fromRef || !toRef) { setHoveredVerses(null); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const sameChapter = fromRef.book === toRef.book && fromRef.chapter === toRef.chapter;
        const [fromRes, toRes] = await Promise.all([
          fetch(`/api/bible/search?q=${encodeURIComponent(`${fromRef.book} ${fromRef.chapter}:${fromRef.verse}`)}`).then(r => r.json()),
          sameChapter ? Promise.resolve(null) : fetch(`/api/bible/search?q=${encodeURIComponent(`${toRef.book} ${toRef.chapter}:${toRef.verse}`)}`).then(r => r.json()),
        ]);
        if (cancelled) return;
        const fromVerse = fromRes.data[0];
        const toVerse   = toRes ? toRes.data[0] : fromRes.data.find((v: any) => v.verseNumber === toRef.verse);
        setHoveredVerses({
          from: fromVerse?.content ?? '', fromSummary: fromVerse?.chapterSummary ?? '',
          to:   toVerse?.content   ?? '', toSummary:   toVerse?.chapterSummary   ?? '',
        });
      } catch { if (!cancelled) setHoveredVerses(null); }
    }, 180);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [hoveredRel, layout]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hoveredCubeUuid || !layout) { setHoveredCubeVerse(null); return; }
    const ref = layout.uuidRefMap.get(hoveredCubeUuid);
    if (!ref) { setHoveredCubeVerse(null); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/bible/search?q=${encodeURIComponent(`${ref.book} ${ref.chapter}:${ref.verse}`)}`).then(r => r.json());
        if (cancelled) return;
        const v = res.data[0];
        setHoveredCubeVerse(v?.content ?? '');
        setHoveredCubeSummary(v?.chapterSummary ?? null);
      } catch { if (!cancelled) setHoveredCubeVerse(null); }
    }, 120);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [hoveredCubeUuid, layout]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (hoveredRel)        setPanelData({ type: 'arc',  rel: hoveredRel, verses: null }); }, [hoveredRel]);
  useEffect(() => { if (hoveredVerses)     setPanelData(p => p?.type === 'arc'  ? { ...p, verses: hoveredVerses } : p); }, [hoveredVerses]);
  useEffect(() => { if (hoveredCubeUuid)   setPanelData({ type: 'cube', uuid: hoveredCubeUuid, verse: null, summary: null }); }, [hoveredCubeUuid]);
  useEffect(() => { if (hoveredCubeVerse)  setPanelData(p => p?.type === 'cube' ? { ...p, verse: hoveredCubeVerse } : p); }, [hoveredCubeVerse]);
  useEffect(() => { if (hoveredCubeSummary !== null) setPanelData(p => p?.type === 'cube' ? { ...p, summary: hoveredCubeSummary } : p); }, [hoveredCubeSummary]);
  useEffect(() => {
    if (hoveredBook && books) {
      const book = books.find(b => b.name === hoveredBook);
      if (book) setPanelData({ type: 'book', book });
    }
  }, [hoveredBook, books]);

  // ── Historical period highlight on cube hover ──────────────────────────
  const hoveredPeriodRange = useMemo<{ startX: number; endX: number } | null>(() => {
    if (!effectiveHoveredBook || sortMode !== 'historical' || !bookOrderData || !layout?.bookLabels.length) return null;
    const dateMap = new Map(bookOrderData.map(b => [b.number, b[histSubMode]]));
    let segment: { startX: number; endX: number } | null = null;
    let currentLabel: string | null = null;
    let currentStartX = 0;
    let currentEndX   = 0;
    let containsHovered = false;
    for (const b of layout.bookLabels) {
      const dateRange = dateMap.get(b.number);
      const label     = dateRange ? String(dateRange[0]) : null;
      if (label !== currentLabel) {
        if (containsHovered) { segment = { startX: currentStartX, endX: currentEndX }; break; }
        currentLabel   = label;
        currentStartX  = b.startX;
        currentEndX    = b.endX;
        containsHovered = b.name === effectiveHoveredBook;
      } else {
        currentEndX = b.endX;
        if (b.name === effectiveHoveredBook) containsHovered = true;
      }
    }
    if (containsHovered && !segment) segment = { startX: currentStartX, endX: currentEndX };
    return segment;
  }, [effectiveHoveredBook, sortMode, bookOrderData, histSubMode, layout?.bookLabels]);

  // X positions of comment squares to show from search hits + displayed relations
  // Active verse UUIDs that should reveal author pins on the globe
  const activeVerseUuids = useMemo<ReadonlySet<string> | null>(() => {
    const uuids = new Set<string>();
    if (panelData?.type === 'cube') uuids.add(panelData.uuid);
    if (searchHitUuids) for (const uuid of searchHitUuids.keys()) uuids.add(uuid);
    if (displayRelations) {
      for (const r of displayRelations) {
        for (const uuid of [r.from, r.toFrom, r.toTo].filter(Boolean)) uuids.add(uuid);
      }
    }
    return uuids.size > 0 ? uuids : null;
  }, [panelData, searchHitUuids, displayRelations]);

  const commentExtraXSet = useMemo<ReadonlySet<number> | null>(() => {
    if (!layout) return null;
    const xs = new Set<number>();
    if (searchHitUuids) {
      for (const uuid of searchHitUuids.keys()) {
        const pos = layout.uuidPosMap.get(uuid);
        if (pos) xs.add(pos.x);
      }
    }
    if (displayRelations) {
      for (const r of displayRelations) {
        for (const uuid of [r.from, r.toFrom, r.toTo].filter(Boolean)) {
          const pos = layout.uuidPosMap.get(uuid);
          if (pos) xs.add(pos.x);
        }
      }
    }
    return xs.size > 0 ? xs : null;
  }, [layout, searchHitUuids, displayRelations]);

  const commentHoverRange = useMemo<{ min: number; max: number } | null>(() => {
    if (!panelData || !layout) return null;
    if (panelData.type === 'cube') {
      const pos = layout.uuidPosMap.get(panelData.uuid);
      return pos ? { min: pos.x, max: pos.x } : null;
    }
    return null;
  }, [panelData, layout]);

  const handleCanvasClick = useCallback((book: string | null) => {
    if (book) open({ book, chapter: 1 });
    else close();
  }, [open, close]);

  // ── Guard: show spinner until all structure data is ready ──────────────
  if (loading || !sortedData || !layout) {
    return <div className={styles.loading}><span className={styles.spinner} /></div>;
  }

  const cx       = layout.totalX / 2;
  const minPeakY = layout.maxTowerY * 0.5;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.canvasContainer}>

        {/* Globe (background, top half) */}

        <div className={styles.bibleMapWrapper}>
          <BibleMap activeVerseUuids={activeVerseUuids} />
        </div>

        {/* 3D graph + frises (foreground, bottom half) */}
        <div className={styles.graphWrapper}>

          {/* Tradition + pulse toggles */}
          <div className={styles.controls}>
            <button
              className={`${styles.pill} ${styles.pillSm} ${showCath ? styles.pillCathActive : ''}`}
              onClick={() => {
                const next = !showCath;
                setShowCath(next);
                if (activeSearchRef) loadRefRelations(activeSearchRef, next, showProtRef.current);
              }}
            >Catholique</button>
            <button
              className={`${styles.pill} ${styles.pillSm} ${showProt ? styles.pillProtActive : ''}`}
              onClick={() => {
                const next = !showProt;
                setShowProt(next);
                if (activeSearchRef) loadRefRelations(activeSearchRef, showCathRef.current, next);
              }}
            >Protestant</button>
            <button
              className={`${styles.pill} ${styles.pillSm} ${showPulse ? styles.pillActive : ''}`}
              onClick={() => setShowPulse(v => !v)}
            >Pulse</button>
            {drawerRelations && (
              <button className={`${styles.pill} ${styles.pillSm}`} onClick={() => setDrawerRelations(null)}>
                ✕ Filtre
              </button>
            )}
          </div>

          {/* Section markers canvas (separate from main so it can overflow) */}
          <div className={styles.markersCanvasWrapper}>
            <Canvas
              orthographic
              frameloop="always"
              gl={{ alpha: true, antialias: true }}
              style={{ background: 'transparent', pointerEvents: 'none' }}
              camera={{ position: [0, 0, 500], zoom: 1 }}
            >
              <SectionMarkers
                layout={layout}
                hoveredBook={effectiveHoveredBook}
                mainCamRef={mainCamRef}
                sortMode={sortMode}
                histSubMode={histSubMode}
                histSecondaryFrise={histSecondaryFrise}
                bookOrderData={bookOrderData}
                sortedData={sortedData}
                kings={kingsData}
                periods={periodsData}
                events={eventsData}
                setHistoricalDate={setHistoricalDate}
                target={target}
              />
            </Canvas>
          </div>

          {/* Main 3D graph canvas */}
          <div className={styles.mainCanvasWrapper}>
            <Canvas
              orthographic
              frameloop="demand"
              camera={{ zoom: 1, position: [stableCx, 200, 800], near: 0.1, far: 10000 }}
              style={{ background: 'transparent', cursor: (effectiveHoveredBook || hoveredArcXs) ? 'pointer' : 'default' }}
            >
              <ambientLight    intensity={0.85} />
              <directionalLight position={[cx, 300, 400]} intensity={1.1} />

              <Cubes
                data={sortedData}
                layout={layout}
                colorMap={sceneColors?.colorMap ?? null}
                bookHasRelation={sceneColors?.bookHasRelation ?? new Set()}
                hoveredBook={effectiveHoveredBook}
                hoveredArcXs={hoveredArcXs}
                hoveredPeriodRange={hoveredPeriodRange}
                destUuids={sceneColors?.destUuids ?? new Set()}
                searchHitUuids={searchHitUuids}
                onCubeHover={setHoveredCubeUuid}
                onCubeClick={uuid => {
                  const ref = layout.uuidRefMap.get(hoveredCubeUuid ?? uuid);
                  if (ref) open({ book: ref.book, chapter: ref.chapter, verse: ref.verse });
                }}
              />

              <CommentSquaresMesh
                layout={layout}
                hoverRange={commentHoverRange}
                extraVisibleXSet={commentExtraXSet}
              />

              <HoverPlane
                bookLabels={layout.bookLabels}
                totalX={layout.totalX}
                maxTowerY={layout.maxTowerY}
                hoveredBook={effectiveHoveredBook}
                onHover={setHoveredBook}
                onCanvasClick={handleCanvasClick}
              />

              <FitCamera totalX={layout.totalX} cx={stableCx} />
              <CameraReporter onUpdate={(x, zoom) => { mainCamRef.current = { x, zoom }; }} />
              <OrbitControls
                target={[stableCx, 0, 0]}
                enableZoom={false}
                enablePan={false}
                enableRotate={false}
              />
              <LockCameraY y={200} />


              {/* Search result badges */}
              {searchBadges.map(badge => (
                <Html key={badge.uuid} position={[badge.x, badge.y + 0.35, 0.05]} center zIndexRange={[100, 100]}>
                  <div
                    className={`${styles.searchBadge} ${badge.isAuthority ? styles.searchBadgeAuthority : ''}`}
                    onClick={e => { e.stopPropagation(); open({ book: badge.book, chapter: badge.chapter, verse: badge.verseStart, verseTo: badge.verseEnd }); }}
                    onMouseEnter={() => {
                      setHoveredCubeUuid(badge.uuid);
                      setPanelData({ type: 'cube', uuid: badge.uuid, verse: null, summary: null, verseEnd: badge.verseEnd > badge.verseStart ? badge.verseEnd : undefined });
                    }}
                    onMouseLeave={() => { setHoveredCubeUuid(null); setPanelData(null); }}
                  >
                    {badge.label}
                  </div>
                </Html>
              ))}

              {/* Arc relations */}
              {displayRelations && (
                <ArcMesh
                  relations={displayRelations}
                  uuidPosMap={layout.uuidPosMap}
                  uuidRefMap={layout.uuidRefMap}
                  minPeakY={minPeakY}
                  showCath={showCath}
                  showProt={showProt}
                  animate={showPulse}
                  fromMapRef={arcFromMapRef}
                  arcAnimStartRef={arcAnimStartRef}
                  onRelClick={openMany}
                  onArcHover={setHoveredArcXs}
                  onArcHoverRel={setHoveredRel}
                />
              )}

            </Canvas>
          </div>

          {panelData && layout && (
            <HoverPanel panelData={panelData} layout={layout} />
          )}

          {/* Search bar */}
          <div className={styles.bottomBar}>
            <SearchInput
              onSubmit={setSubmittedQuery}
              onClear={() => {
                setSubmittedQuery('');
                startTransition(() => {
                  setSearchHitUuids(null);
                  setActiveSearchRef(null);
                  setDrawerRelations(null);
                });
              }}
            />
          </div>

          {/* Frise type selector (historical mode) */}
          {sortMode === 'historical' && (
            <div className={styles.friseSelector}>
              {(['kings', 'periods', 'events'] as const).map(val => (
                <button
                  key={val}
                  className={`${styles.sortBtn} ${histSecondaryFrise === val ? styles.sortBtnActive : ''}`}
                  onClick={() => setHistSecondaryFrise(val)}
                >
                  {{ kings: 'Rois', periods: 'Périodes', events: 'Événements' }[val]}
                </button>
              ))}
            </div>
          )}

          {/* Sort panel */}
          <div className={styles.sortPanel}>
            {sortMode === 'historical' && (
              <div className={styles.histDropup}>
                {(Object.keys(HIST_SUB_LABELS) as HistoricalSubMode[]).map(sub => (
                  <button
                    key={sub}
                    className={`${styles.sortBtn} ${histSubMode === sub ? styles.sortBtnActive : ''}`}
                    onClick={() => handleHistSubMode(sub)}
                  >{HIST_SUB_LABELS[sub]}</button>
                ))}
              </div>
            )}
            <span className={styles.sortLabel}>Ordre</span>
            {(Object.keys(SORT_LABELS) as BookSortMode[]).map(mode => (
              <button
                key={mode}
                className={`${styles.sortBtn} ${sortMode === mode ? styles.sortBtnActive : ''}`}
                onClick={() => handleSortMode(mode)}
              >{SORT_LABELS[mode]}</button>
            ))}
          </div>

        </div>{/* /graphWrapper */}
      </div>{/* /canvasContainer */}

      {/* Tradition confirmation modal */}
      {tradConfirm && (
        <div className={styles.modalOverlay} onClick={() => setTradConfirm(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <p className={styles.modalTitle}>Traditions masquées</p>
            <p className={styles.modalText}>
              {tradConfirm.traditions.length === 1
                ? `Ce passage contient des relations de tradition ${tradConfirm.traditions[0]}, actuellement masquée. Souhaitez-vous l'afficher ?`
                : `Ce passage contient des relations de traditions ${tradConfirm.traditions.join(' et ')}, actuellement masquées. Souhaitez-vous les afficher ?`}
            </p>
            <div className={styles.modalActions}>
              <button className={styles.modalCancel}  onClick={() => setTradConfirm(null)}>Ignorer</button>
              <button className={styles.modalConfirm} onClick={tradConfirm.onConfirm}>Afficher</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
