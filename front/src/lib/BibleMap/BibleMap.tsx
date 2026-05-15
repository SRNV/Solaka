import { useEffect, useMemo, useRef, useState } from 'react';
import { mountScene, type CameraState, type SceneControls, type AuthorPin } from './scene.ts';
import { useApi } from '../../hooks/useApi.ts';
import { GeoMap } from '../../types/api.ts';
import { useBibleDrawer } from '../../contexts/BibleDrawerContext.tsx';
import { getOsisRef } from './osisUtils.ts';
import { biblicalPlacesService } from '../../services/biblicalPlacesService.ts';
import { useStompMapFeatures } from '../../hooks/useStompMapFeatures.ts';
import { useStompPlaces } from '../../hooks/useStompPlaces.ts';
import { usePatristicCommentStore } from '../../store/comment.store.ts';
import authorPositions from '../../data/authorPositions.json';
import atlasIndex from '../../data/atlas.json';

type PosEntry   = { lon: number; lat: number; nameFr: string; tradition: string; type?: 'patristic' | 'magistere' };
type AtlasEntry = { x: number; y: number; width: number; height: number };

const authorPins: AuthorPin[] = Object.entries(
  authorPositions as Record<string, PosEntry>
).map(([slug, pos]) => {
  const tile = (atlasIndex as Record<string, AtlasEntry>)[slug];
  return {
    slug,
    lon:        pos.lon,
    lat:        pos.lat,
    nameFr:     pos.nameFr,
    atlasX:     tile?.x ?? 0,
    atlasY:     tile?.y ?? 0,
    borderType: (pos.type ?? 'patristic') === 'magistere' ? 1.0 : 0.0,
  };
});


export function BibleMap({ activeVerseUuids }: { activeVerseUuids: ReadonlySet<string> | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ctrlRef      = useRef<SceneControls | null>(null);
  const { historicalDate, target } = useBibleDrawer();

  const { data: geoMaps }    = useApi<GeoMap[]>('/api/geomap');
  const { data: apostlesData } = useApi<{ type: string; features: any[] }>('/api/apostles');

  const bestMapId = useMemo(() => {
    if (!geoMaps) return null;
    const sorted = [...geoMaps]
      .filter(gm => gm.year !== null)
      .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
    if (!sorted.length) return null;
    if (historicalDate === null) return sorted[sorted.length - 1];
    
    // Find map with minimum absolute distance to historicalDate
    let best: GeoMap = sorted[0];
    let minDist = Math.abs((best.year ?? 0) - historicalDate);
    
    for (let i = 1; i < sorted.length; i++) {
      const dist = Math.abs((sorted[i].year ?? 0) - historicalDate);
      if (dist < minDist) {
        minDist = dist;
        best = sorted[i];
      }
    }
    return best;
  }, [geoMaps, historicalDate]);

  const { features: mapFeatures } = useStompMapFeatures(bestMapId?.id ?? null);
  const { features: baseFeatures } = useStompMapFeatures('projection_countries');

  const { places: bgdPlaces }      = useStompPlaces('bgd');

  const [projectionId]                   = useState<string | null>(null);
  const { features: projectionFeatures } = useStompMapFeatures(projectionId);
  const [currentMapLabel, setCurrentMapLabel] = useState<string | null>(null);
  const [, setCam] = useState<CameraState | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ctrl = mountScene(containerRef.current, setCam);
    ctrlRef.current = ctrl;
    ctrl.setDisplacement(0);
    ctrl.setAuthors([]);
    return ctrl.cleanup;
  }, []);

  const summaries      = usePatristicCommentStore(s => s.summaries);
  const authorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (authorTimerRef.current) clearTimeout(authorTimerRef.current);
    authorTimerRef.current = setTimeout(() => {
      if (!ctrlRef.current) return;
      if (!activeVerseUuids) { ctrlRef.current.setAuthors([]); return; }
      const visibleSlugs = new Set<string>();
      for (const uuid of activeVerseUuids) {
        const s = summaries.get(uuid);
        if (s) for (const a of s.authors) visibleSlugs.add(a.slug);
      }
      ctrlRef.current.setAuthors(authorPins.filter(p => visibleSlugs.has(p.slug)));
    }, 120);
    return () => { if (authorTimerRef.current) clearTimeout(authorTimerRef.current); };
  }, [activeVerseUuids, summaries]);

  useEffect(() => {
    if (!projectionId) setCurrentMapLabel(bestMapId?.label ?? null);
  }, [bestMapId, projectionId]);

  useEffect(() => {
    ctrlRef.current?.updateHistoricalBorders({ type: 'FeatureCollection', features: mapFeatures });
  }, [mapFeatures, bestMapId]);

  useEffect(() => {
    ctrlRef.current?.updateProjectionFeatures(baseFeatures, true);
  }, [baseFeatures]);

  useEffect(() => {
    ctrlRef.current?.updateProjectionFeatures(projectionFeatures, false);
  }, [projectionFeatures]);

  useEffect(() => {
    ctrlRef.current?.setBGDPlaces(bgdPlaces);
  }, [bgdPlaces]);

  useEffect(() => {
    ctrlRef.current?.setApostles(apostlesData ?? null, atlasIndex as Record<string, { x: number; y: number }>);
  }, [apostlesData]);

  useEffect(() => {
    ctrlRef.current?.setJourneyDate(historicalDate);
  }, [historicalDate]);

  useEffect(() => {
    if (!target) {
      ctrlRef.current?.setBiblicalPlaces([]);
      return;
    }

    const osis = getOsisRef(target.book, target.chapter);
    biblicalPlacesService.getByVerse(osis)
      .then(data => {
        ctrlRef.current?.setBiblicalPlaces(data);
      })
      .catch(err => {
        console.error('Error fetching biblical places', err);
      });
  }, [target]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {currentMapLabel && (
        <h1 style={{
          position: 'absolute', top: 16, left: 16,
          margin: 0, padding: 0,
          color: 'rgba(255,255,255,0.85)',
          fontSize: 28, fontWeight: 700, letterSpacing: '0.5px',
          pointerEvents: 'none', userSelect: 'none',
          textShadow: '0 2px 12px rgba(0,0,0,0.5)',
          zIndex: 20,
        }}>
          {currentMapLabel}
        </h1>
      )}
      </div>
  );
}
