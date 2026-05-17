import { useCallback, useEffect, useMemo, useRef, useState, startTransition, type MutableRefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { usePaginatedAllApi } from '@/hooks/usePaginatedAllApi.ts';
import { useStompRelations } from '@/hooks/useStompRelations.ts';
import { useStompSearch } from '@/hooks/useStompSearch.ts';
import { bibleStore } from '@/store/bible.store.ts';
import type {
  BibleBookMeta, BibleBookOrder, BibleEvent,
  BibleRelation, BibleStructureBook, BookSortMode,
  HistoricalPeriod, HistoricalSubMode, King,
} from '@/models/bible';
import { useBibleDrawer, type BibleTarget } from '@/contexts/BibleDrawerContext.tsx';
import { parseRef } from '@/utils/bibleRef.ts';
import { computeLayout, type LayoutResult } from '@/utils/graphLayout.ts';
import { useRelationsStore, relsFetched } from '@/store/relations.store.ts';
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
import { BibleMap } from '@/lib/BibleMap/index.ts';
import { TraditionPills } from './TraditionPills.tsx';
import { SortPanel } from './SortPanel.tsx';
import { FriseSelector, type FriseType } from './FriseSelector.tsx';
import { useSceneColors } from './useSceneColors.ts';
import { useRelationsStream } from './useRelationsStream.ts';
import { useSearchBadges } from './useSearchBadges.ts';
import { useHoverPanel } from './useHoverPanel.ts';
import { useCommentHighlights } from './useCommentHighlights.ts';
import styles from './GraphPage.module.css';

function normText(s: string): string {
  return s
    .toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[''ʼ]/g, "'")
    .replace(/\s+/g, ' ').trim();
}

// ── GraphPage ──────────────────────────────────────────────────────────────

export function GraphPage() {
  usePatristicCommentIndex();

  // ── Tradition toggles ───────────────────────────────────────────────────
  const [showCath,    setShowCath]    = useState(true);
  const [showProt,    setShowProt]    = useState(false);
  const [showPulse,   setShowPulse]   = useState(false);
  const [tradConfirm, setTradConfirm] = useState<{ traditions: string[]; onConfirm: () => void } | null>(null);
  const showCathRef = useRef(showCath);
  const showProtRef = useRef(showProt);
  showCathRef.current = showCath;
  showProtRef.current = showProt;

  // ── Data fetching ───────────────────────────────────────────────────────
  const { data: structData, loading: sLoading } = usePaginatedAllApi<BibleStructureBook>('/api/bible/structure');
  const { data: orderData,  loading: oLoading }  = usePaginatedAllApi<BibleBookOrder>('/api/bible/book-order');
  const { data: metaData,   loading: mLoading }  = usePaginatedAllApi<BibleBookMeta>('/api/bible/books');
  const [kingsData,   setKingsData]   = useState<King[] | null>(null);
  const [periodsData, setPeriodsData] = useState<HistoricalPeriod[] | null>(null);
  const [eventsData,  setEventsData]  = useState<BibleEvent[] | null>(null);
  const loading       = sLoading || oLoading || mLoading;
  const books         = metaData;
  const bookOrderData = orderData;

  // ── Sort ────────────────────────────────────────────────────────────────
  const [sortMode,           setSortMode]           = useState<BookSortMode>('classic');
  const [histSubMode,        setHistSubMode]        = useState<HistoricalSubMode>('authorPeriod');
  const [histSecondaryFrise, setHistSecondaryFrise] = useState<FriseType>('kings');

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

  // ── Layout ──────────────────────────────────────────────────────────────
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

  const initialCxRef = useRef<number | null>(null);
  if (layout && initialCxRef.current === null) initialCxRef.current = layout.totalX / 2;
  const stableCx = initialCxRef.current ?? 0;
  const mainCamRef = useRef({ x: stableCx, zoom: 1 });

  // ── Drawer ──────────────────────────────────────────────────────────────
  const { open, openMany, close, showInMapCount, mapTargets, target, targets, setHistoricalDate } = useBibleDrawer();

  // ── Hover panel ─────────────────────────────────────────────────────────
  const {
    setHoveredBook,
    hoveredArcXs,    setHoveredArcXs,
                     setHoveredRel,
    hoveredCubeUuid, setHoveredCubeUuid,
    panelData,       setPanelData,
    effectiveHoveredBook,
  } = useHoverPanel(layout, books);

  // ── Relations ───────────────────────────────────────────────────────────
  const [relationsEnabled,     setRelationsEnabled]     = useState(false);
  const [activeRelationsQuery, setActiveRelationsQuery] = useState('');
  const [drawerRelations,      setDrawerRelations]      = useState<BibleRelation[] | null>(null);

  const loadRefRelations = useCallback((t: BibleTarget, cath: boolean, prot: boolean) => {
    setShowCath(cath);
    setShowProt(prot);
    const v = t.verse != null ? ` ${t.verse}${t.verseTo && t.verseTo !== t.verse ? `–${t.verseTo}` : ''}` : '';
    setActiveRelationsQuery(`${t.book} ${t.chapter}${v}`);
    setRelationsEnabled(true);
  }, []);

  const { relations: stompRelations } = useStompRelations(relationsEnabled, showCath, showProt, activeRelationsQuery);
  const displayRelations = useRelationsStream(stompRelations, drawerRelations, layout);

  // ── Text search ─────────────────────────────────────────────────────────
  const [textSearchQuery, setTextSearchQuery] = useState('');
  const [submittedQuery,  setSubmittedQuery]  = useState('');
  const [searchHitUuids,  setSearchHitUuids]  = useState<Map<string, string> | null>(null);
  const [activeSearchRef, setActiveSearchRef] = useState<ReturnType<typeof parseRef> | null>(null);
  const { results: stompSearchResults } = useStompSearch(textSearchQuery);
  const textExtraTermsRef = useRef<string[]>([]);

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
  }, [submittedQuery, books]);

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

  // ── Derived scene data ───────────────────────────────────────────────────
  const searchBadges   = useSearchBadges(searchHitUuids, layout, stompRelations, drawerRelations);
  const sceneColors    = useSceneColors(layout, displayRelations, showCath, showProt);
  const { activeVerseUuids, commentExtraXSet, commentHoverRange } =
    useCommentHighlights(panelData, searchHitUuids, displayRelations, layout);

  // ── Arc layout animation ─────────────────────────────────────────────────
  const arcFromMapRef    = useRef<Map<string, { x: number; y: number; z: number }> | null>(null) as MutableRefObject<Map<string, { x: number; y: number; z: number }> | null>;
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

  // ── Drawer → map relations ───────────────────────────────────────────────
  const lastShowInMapCount = useRef(0);
  const layoutRef = useRef<typeof layout>(null);
  layoutRef.current = layout;

  useEffect(() => {
    if (showInMapCount === 0 || showInMapCount === lastShowInMapCount.current) return;
    lastShowInMapCount.current = showInMapCount;
    const activeTargets = mapTargets ?? (targets.length > 0 ? targets : target ? [target] : []);
    if (!activeTargets.length) return;

    setDrawerRelations(null);

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
  }, [showInMapCount, mapTargets]); // targets/target read from closure at trigger time

  // ── Historical date sync ─────────────────────────────────────────────────
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

  // ── Historical period highlight ──────────────────────────────────────────
  const hoveredPeriodRange = useMemo<{ startX: number; endX: number } | null>(() => {
    if (!effectiveHoveredBook || sortMode !== 'historical' || !bookOrderData || !layout?.bookLabels.length) return null;
    const dateMap = new Map(bookOrderData.map(b => [b.number, b[histSubMode]]));
    let segment: { startX: number; endX: number } | null = null;
    let currentLabel: string | null = null;
    let currentStartX = 0, currentEndX = 0;
    let containsHovered = false;
    for (const b of layout.bookLabels) {
      const dateRange = dateMap.get(b.number);
      const label     = dateRange ? String(dateRange[0]) : null;
      if (label !== currentLabel) {
        if (containsHovered) { segment = { startX: currentStartX, endX: currentEndX }; break; }
        currentLabel    = label;
        currentStartX   = b.startX;
        currentEndX     = b.endX;
        containsHovered = b.name === effectiveHoveredBook;
      } else {
        currentEndX = b.endX;
        if (b.name === effectiveHoveredBook) containsHovered = true;
      }
    }
    if (containsHovered && !segment) segment = { startX: currentStartX, endX: currentEndX };
    return segment;
  }, [effectiveHoveredBook, sortMode, bookOrderData, histSubMode, layout?.bookLabels]);

  const handleCanvasClick = useCallback((book: string | null) => {
    if (book) open({ book, chapter: 1 });
    else close();
  }, [open, close]);

  // ── Guard ────────────────────────────────────────────────────────────────
  if (loading || !sortedData || !layout) {
    return <div className={styles.loading}><span className={styles.spinner} /></div>;
  }

  const cx       = layout.totalX / 2;
  const minPeakY = layout.maxTowerY * 0.5;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.canvasContainer}>

        <div className={styles.bibleMapWrapper}>
          <BibleMap activeVerseUuids={activeVerseUuids} />
        </div>

        <div className={styles.graphWrapper}>

          <TraditionPills
            showCath={showCath}
            showProt={showProt}
            showPulse={showPulse}
            hasFilter={!!drawerRelations}
            onToggleCath={() => {
              const next = !showCath;
              setShowCath(next);
              if (activeSearchRef) loadRefRelations(activeSearchRef, next, showProtRef.current);
            }}
            onToggleProt={() => {
              const next = !showProt;
              setShowProt(next);
              if (activeSearchRef) loadRefRelations(activeSearchRef, showCathRef.current, next);
            }}
            onTogglePulse={() => setShowPulse(v => !v)}
            onClearFilter={() => setDrawerRelations(null)}
          />

          {/* Section markers canvas */}
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
              <ambientLight intensity={0.85} />
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

          {sortMode === 'historical' && (
            <FriseSelector value={histSecondaryFrise} onChange={setHistSecondaryFrise} />
          )}

          <SortPanel
            sortMode={sortMode}
            histSubMode={histSubMode}
            onSortMode={handleSortMode}
            onHistSubMode={handleHistSubMode}
          />

        </div>{/* /graphWrapper */}
      </div>{/* /canvasContainer */}

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
