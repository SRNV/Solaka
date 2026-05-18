import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useTextSearch } from './useTextSearch';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { usePaginatedAllApi } from '@/hooks/usePaginatedAllApi.ts';
import { useStompRelations } from '@/hooks/useStompRelations.ts';
import { bibleStore } from '@/store/bible.store.ts';
import type {
  BibleBookMeta, BibleBookOrder, BibleEvent,
  BibleRelation, BibleStructureBook, BookSortMode,
  HistoricalPeriod, HistoricalSubMode, King,
} from '@/models/bible';
import { useBibleDrawer, type BibleTarget } from '@/contexts/BibleDrawerContext.tsx';
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
import { BibleMap } from '@/lib/BibleMap/index.ts';
import { TraditionPills } from './TraditionPills.tsx';
import { SortPanel } from './SortPanel.tsx';
import { FriseSelector } from './FriseSelector.tsx';
import { useSceneColors } from './useSceneColors.ts';
import { useRelationsStream } from './useRelationsStream.ts';
import { useSearchBadges } from './useSearchBadges.ts';
import { useHoverPanel } from './useHoverPanel.ts';
import { useCommentHighlights } from './useCommentHighlights.ts';
import { buildYearPoints, yearToWorldX, worldXToYear } from './friseUtils';
import { ScrubberFeature } from './ScrubberFeature';
import { ScrubberCanvas } from './ScrubberCanvas';
import { useGraphModeStore } from '@/store/graphMode.store';
import { useYearMarkersStore } from '@/store/yearMarkers.store';
import styles from './GraphPage.module.css';

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

  // ── Sort (shared store) ─────────────────────────────────────────────────
  const { sortMode, histSubMode, histSecondaryFrise, setSortMode, setHistSubMode, setHistSecondaryFrise } = useGraphModeStore();

  const handleSortMode = useCallback((mode: BookSortMode) => {
    if (mode !== sortMode) setSortMode(mode);
  }, [sortMode, setSortMode]);

  // Lazy-load historical data whenever sortMode becomes 'historical'
  // (triggered by SortPanel, ScrubberFeature, or any other source)
  const kingsDataRef   = useRef(kingsData);
  const periodsDataRef = useRef(periodsData);
  const eventsDataRef  = useRef(eventsData);
  kingsDataRef.current   = kingsData;
  periodsDataRef.current = periodsData;
  eventsDataRef.current  = eventsData;

  useEffect(() => {
    if (sortMode !== 'historical') return;
    if (!eventsDataRef.current)  bibleStore.events().then(setEventsData);
    if (!kingsDataRef.current)   bibleStore.kings().then(setKingsData);
    if (!periodsDataRef.current) bibleStore.periods().then(setPeriodsData);
  }, [sortMode]);

  const handleHistSubMode = useCallback((sub: HistoricalSubMode) => {
    if (sub !== histSubMode) setHistSubMode(sub);
  }, [histSubMode, setHistSubMode]);

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

  // ── Timeline / scrubber ──────────────────────────────────────────────────
  const mainCanvasWrapperRef = useRef<HTMLDivElement>(null);

  const yearRange = useMemo(() => {
    if (sortMode !== 'historical' || !bookOrderData) return null;
    const years = bookOrderData.flatMap(b => [b[histSubMode][0], b[histSubMode][1]]);
    return { min: Math.min(...years), max: Math.max(...years) };
  }, [sortMode, bookOrderData, histSubMode]);

  const yearPoints = useMemo(() => {
    if (sortMode !== 'historical' || !bookOrderData || !layout?.bookLabels.length) return [];
    return buildYearPoints(bookOrderData, layout.bookLabels, histSubMode);
  }, [sortMode, bookOrderData, layout, histSubMode]);

  // Push yearPoints + year0WorldX into shared store (consumed by ScrubberFeature, YearZeroBar, etc.)
  const { setYearPoints, setYear0WorldX } = useYearMarkersStore();
  useEffect(() => {
    setYearPoints(yearPoints);
    setYear0WorldX(yearPoints.length > 0 ? yearToWorldX(0, yearPoints) : null);
  }, [yearPoints, setYearPoints, setYear0WorldX]);

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
  const { setSubmittedQuery, searchHitUuids, activeSearchRef, clearSearch } = useTextSearch(books, {
    onClearDrawerRelations: () => setDrawerRelations(null),
    onSetRelationsQuery:    setActiveRelationsQuery,
    onSetRelationsEnabled:  setRelationsEnabled,
  });

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

  const handleCanvasClick = useCallback((book: string | null, worldX: number) => {
    if (sortMode === 'historical') {
      if (yearPoints.length > 0) setHistoricalDate(Math.round(worldXToYear(worldX, yearPoints)));
      return;
    }
    if (book) open({ book, chapter: 1 });
    else close();
  }, [sortMode, yearPoints, setHistoricalDate, open, close]);

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

          <ScrubberFeature
            bookOrderData={bookOrderData}
            mainCanvasWrapperRef={mainCanvasWrapperRef}
            mainCamRef={mainCamRef}
            yearRange={yearRange}
          />

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
                target={target}
              />
            </Canvas>
          </div>

          {/* Main 3D graph canvas */}
          <div ref={mainCanvasWrapperRef} className={styles.mainCanvasWrapper}>
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
                  if (sortMode === 'historical') return;
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

              <ScrubberCanvas data={sortedData} layout={layout} />

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
              onClear={clearSearch}
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
