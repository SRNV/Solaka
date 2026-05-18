import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { usePaginatedAllApi }      from '@/hooks/usePaginatedAllApi.ts';
import { usePatristicCommentIndex } from '@/hooks/useCommentIndex.ts';
import type { BibleBookMeta, BibleBookOrder, BibleStructureBook } from '@/models/bible';
import { useBibleDrawer }          from '@/contexts/BibleDrawerContext.tsx';
import { computeLayout }           from '@/utils/graphLayout.ts';
import { useActiveRelationsStore } from '@/store/activeRelations.store';
import { useTraditionStore }       from '@/store/tradition.store';
import { useGraphModeStore }       from '@/store/graphMode.store';
import { useYearMarkersStore }     from '@/store/yearMarkers.store';
import { Cubes }               from './Cubes.tsx';
import { CommentSquaresMesh }  from './CommentSquaresMesh.tsx';
import { HoverPlane }          from './HoverPlane.tsx';
import { SectionMarkers }      from './SectionMarkers.tsx';
import { CameraSync, FitCamera, HorizontalMasterControls, LockCameraY } from './CameraHelpers.tsx';
import { HoverPanel }          from './HoverPanel.tsx';
import { useSceneColors }      from './useSceneColors.ts';
import { useHoverPanel }       from './useHoverPanel.ts';
import { useCommentHighlights } from './useCommentHighlights.ts';
import { worldXToYear }        from './friseUtils';
import { useRelations }        from './useRelations';
import { useYearMarkers }      from './useYearMarkers';
import { useHoveredPeriod }    from './useHoveredPeriod';
import { useTimeline, SPEEDS } from './useTimeline';
import { ScrubberCanvas }      from './ScrubberCanvas';
import { RelationsCanvas }     from './RelationsCanvas';
import { SearchBadgesCanvas }  from './SearchBadgesCanvas';
import { SearchFeature }       from './SearchFeature';
import { SortFeature }         from './SortFeature';
import { ControlIcons }        from './ControlIcons';
import styles from './GraphPage.module.css';

/**
 * Owns 3D graph layout, data, scene state, timeline, search, and controls.
 * The globe (BibleMapFeature) lives as a sibling in GraphPage.
 */
export function GlobalPlayerComponent() {
  usePatristicCommentIndex();
  const setInvalidateCanvas = useYearMarkersStore(s => s.setInvalidateCanvas);

  // ── Data ────────────────────────────────────────────────────────────────
  const { data: structData, loading: sLoading } = usePaginatedAllApi<BibleStructureBook>('/api/bible/structure');
  const { data: bookOrderData, loading: oLoading } = usePaginatedAllApi<BibleBookOrder>('/api/bible/book-order');
  const { data: metaData,   loading: mLoading }  = usePaginatedAllApi<BibleBookMeta>('/api/bible/books');
  const loading = sLoading || oLoading || mLoading;

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

  // ── Camera initial centre ─────────────────────────────────────────────────
  const initialCxRef = useRef<number | null>(null);
  if (layout && initialCxRef.current === null) initialCxRef.current = layout.totalX / 2;
  const stableCx = initialCxRef.current ?? 0;

  // ── Stores & drawer ──────────────────────────────────────────────────────
  const { open, close, setHistoricalDate }             = useBibleDrawer();
  const { showCath, showProt }                         = useTraditionStore();
  const { displayRelations, drawerRelations, searchHitUuids, setActiveVerseUuids } = useActiveRelationsStore();

  // ── Register canvas container → store (scrubber drag coord) ──────────────
  const setCanvasContainerEl = useYearMarkersStore(s => s.setCanvasContainerEl);
  const canvasContainerRef   = useCallback(
    (el: HTMLDivElement | null) => setCanvasContainerEl(el),
    [setCanvasContainerEl],
  );

  // ── Feature hooks ────────────────────────────────────────────────────────
  useYearMarkers(layout, bookOrderData);
  const { stompRelations } = useRelations(layout);

  const {
    setHoveredBook, hoveredArcXs, setHoveredArcXs, setHoveredRel,
    hoveredCubeUuid, setHoveredCubeUuid, panelData, setPanelData, effectiveHoveredBook,
  } = useHoverPanel(layout, metaData);

  const {
    isPlaying, playSpeed, handlePlay, handleClose, handleScrubberMouseDown, handleRef, setSpeed,
  } = useTimeline(bookOrderData);

  // ── Derived scene data ───────────────────────────────────────────────────
  const sceneColors        = useSceneColors(layout, displayRelations, showCath, showProt);
  const hoveredPeriodRange = useHoveredPeriod(effectiveHoveredBook, layout, bookOrderData);
  const { activeVerseUuids, commentExtraXSet, commentHoverRange } =
    useCommentHighlights(panelData, searchHitUuids, displayRelations, layout);

  // Sync activeVerseUuids to store so BibleMapFeature can read it autonomously
  useEffect(() => {
    setActiveVerseUuids(activeVerseUuids ?? new Set());
  }, [activeVerseUuids, setActiveVerseUuids]);

  // ── Canvas click ─────────────────────────────────────────────────────────
  const handleCanvasClick = useCallback((book: string | null, worldX: number) => {
    if (sortMode === 'historical') {
      const { yearPoints } = useYearMarkersStore.getState();
      if (yearPoints.length > 0) setHistoricalDate(Math.round(worldXToYear(worldX, yearPoints)));
      return;
    }
    if (book) open({ book, chapter: 1 });
    else close();
  }, [sortMode, setHistoricalDate, open, close]);

  // ── Loading guard ────────────────────────────────────────────────────────
  if (loading || !sortedData || !layout) {
    return <div className={styles.loading}><span className={styles.spinner} /></div>;
  }

  const cx       = layout.totalX / 2;
  const minPeakY = layout.maxTowerY * 0.5;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.graphWrapper}>

      {/* Row 1: Play + Hover info + Control Icons */}
      <div className={styles.topRow}>
        <div className={styles.topRowLeft}>
          <button className={styles.playBtn} onClick={handlePlay} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          {panelData && <HoverPanel panelData={panelData} layout={layout} />}
        </div>
        <ControlIcons />
      </div>

      {/* Row 2: canvas area */}
      <div className={styles.playerRow}>
        <div className={styles.canvasArea}>
          {/* Main 3D graph */}
          <div ref={canvasContainerRef} className={styles.mainCanvasWrapper}>
            <Canvas
              orthographic
              frameloop="demand"
              onCreated={({ invalidate }) => setInvalidateCanvas(invalidate)}
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
                hideLabels={true}
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

              <CameraSync y={minPeakY + 40} />

              <ScrubberCanvas data={sortedData} layout={layout} />

              <RelationsCanvas
                layout={layout}
                minPeakY={minPeakY}
                onArcHover={setHoveredArcXs}
                onArcHoverRel={setHoveredRel}
              />

              <SearchBadgesCanvas
                layout={layout}
                stompRelations={stompRelations}
                drawerRelations={drawerRelations}
                setHoveredCubeUuid={setHoveredCubeUuid}
                setPanelData={setPanelData}
              />
            </Canvas>
          </div>

          {/* Scrubber drag handle (invisible, positioned by ScrubberSync each frame) */}
          {sortMode === 'historical' && (
            <div ref={handleRef} className={styles.scrubberHandle} onMouseDown={handleScrubberMouseDown} />
          )}

          {/* Lazy-loads historical data (kings, periods, events) into store */}
          <SortFeature />
        </div>
      </div>

      {/* Row 3: Section markers row */}
      <div className={styles.markersRow}>
        <div className={styles.markersCanvasWrapper}>
          <Canvas
            orthographic
            frameloop="always"
            gl={{ alpha: true, antialias: true }}
            style={{ background: 'transparent' }}
            camera={{ position: [stableCx, 0, 500], zoom: 1 }}
          >
            <SectionMarkers
              layout={layout}
              hoveredBook={effectiveHoveredBook}
              sortMode={sortMode}
              histSubMode={histSubMode}
              histSecondaryFrise={histSecondaryFrise}
              bookOrderData={bookOrderData}
              sortedData={sortedData}
            />
            <FitCamera totalX={layout.totalX} cx={stableCx} y={0} />
            <CameraSync y={0} />
            <HorizontalMasterControls />
            <LockCameraY y={0} />
          </Canvas>
        </div>
      </div>

      {/* Row 4: search bar */}
      <div className={styles.controlsRow}>
        <SearchFeature books={metaData} />
      </div>

    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <polygon points="6,3 20,12 6,21" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <rect x="5"  y="4" width="4.5" height="16" rx="1" />
      <rect x="14" y="4" width="4.5" height="16" rx="1" />
    </svg>
  );
}
