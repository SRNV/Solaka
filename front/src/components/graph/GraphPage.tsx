import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { usePaginatedAllApi } from '@/hooks/usePaginatedAllApi.ts';
import type { BibleBookMeta, BibleBookOrder, BibleStructureBook } from '@/models/bible';
import { useBibleDrawer } from '@/contexts/BibleDrawerContext.tsx';
import { computeLayout } from '@/utils/graphLayout.ts';
import { useActiveRelationsStore } from '@/store/activeRelations.store';
import { useTraditionStore }       from '@/store/tradition.store';
import { useGraphModeStore }       from '@/store/graphMode.store';
import { useYearMarkersStore }     from '@/store/yearMarkers.store';
import { Cubes }               from './Cubes.tsx';
import { CommentSquaresMesh }  from './CommentSquaresMesh.tsx';
import { usePatristicCommentIndex } from '@/hooks/useCommentIndex.ts';
import { HoverPlane }          from './HoverPlane.tsx';
import { SectionMarkers }      from './SectionMarkers.tsx';
import { CameraReporter, FitCamera, LockCameraY } from './CameraHelpers.tsx';
import { HoverPanel }          from './HoverPanel.tsx';
import { BibleMap }            from '@/lib/BibleMap/index.ts';
import { useSceneColors }      from './useSceneColors.ts';
import { useSearchBadges }     from './useSearchBadges.ts';
import { useHoverPanel }       from './useHoverPanel.ts';
import { useCommentHighlights } from './useCommentHighlights.ts';
import { buildYearPoints, yearToWorldX, worldXToYear } from './friseUtils';
import { useRelations }        from './useRelations';
import { ScrubberFeature }     from './ScrubberFeature';
import { ScrubberCanvas }      from './ScrubberCanvas';
import { RelationsCanvas }     from './RelationsCanvas';
import { TraditionFeature }    from './TraditionFeature';
import { SearchFeature }       from './SearchFeature';
import { SortFeature }         from './SortFeature';
import styles from './GraphPage.module.css';

export function GraphPage() {
  usePatristicCommentIndex();

  // ── Data ────────────────────────────────────────────────────────────────
  const { data: structData, loading: sLoading } = usePaginatedAllApi<BibleStructureBook>('/api/bible/structure');
  const { data: orderData,  loading: oLoading }  = usePaginatedAllApi<BibleBookOrder>('/api/bible/book-order');
  const { data: metaData,   loading: mLoading }  = usePaginatedAllApi<BibleBookMeta>('/api/bible/books');
  const loading       = sLoading || oLoading || mLoading;
  const bookOrderData = orderData;

  // ── Sort + layout ────────────────────────────────────────────────────────
  const { sortMode, histSubMode, histSecondaryFrise } = useGraphModeStore();

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

  // ── Camera ───────────────────────────────────────────────────────────────
  const initialCxRef = useRef<number | null>(null);
  if (layout && initialCxRef.current === null) initialCxRef.current = layout.totalX / 2;
  const stableCx  = initialCxRef.current ?? 0;
  const mainCamRef = useRef({ x: stableCx, zoom: 1 });

  // ── Drawer ───────────────────────────────────────────────────────────────
  const { open, close, setHistoricalDate } = useBibleDrawer();

  // ── Scrubber data (yearRange/yearPoints → store) ─────────────────────────
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

  const { setYearPoints, setYear0WorldX } = useYearMarkersStore();
  useEffect(() => {
    setYearPoints(yearPoints);
    setYear0WorldX(yearPoints.length > 0 ? yearToWorldX(0, yearPoints) : null);
  }, [yearPoints, setYearPoints, setYear0WorldX]);

  // ── Feature hooks ────────────────────────────────────────────────────────
  const { stompRelations } = useRelations(layout);

  const { showCath, showProt } = useTraditionStore();
  const { displayRelations, drawerRelations, searchHitUuids } = useActiveRelationsStore();

  const {
    setHoveredBook, hoveredArcXs, setHoveredArcXs, setHoveredRel,
    hoveredCubeUuid, setHoveredCubeUuid, panelData, setPanelData, effectiveHoveredBook,
  } = useHoverPanel(layout, metaData);

  // ── Derived scene data ───────────────────────────────────────────────────
  const searchBadges = useSearchBadges(searchHitUuids, layout, stompRelations, drawerRelations);
  const sceneColors  = useSceneColors(layout, displayRelations, showCath, showProt);
  const { activeVerseUuids, commentExtraXSet, commentHoverRange } =
    useCommentHighlights(panelData, searchHitUuids, displayRelations, layout);

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

          <TraditionFeature />

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

              <RelationsCanvas
                layout={layout}
                minPeakY={minPeakY}
                onArcHover={setHoveredArcXs}
                onArcHoverRel={setHoveredRel}
              />

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

            </Canvas>
          </div>

          {panelData && <HoverPanel panelData={panelData} layout={layout} />}

          <SearchFeature books={metaData} />

          <SortFeature />

        </div>
      </div>
    </div>
  );
}
