import { useEffect, useMemo, useRef, useState } from 'react';
import { mountScene, type CameraState, type SceneControls } from './scene.ts';
import { useApi } from '../../hooks/useApi.ts';
import { GeoMap } from '../../types/api.ts';
import { useBibleDrawer } from '../../contexts/BibleDrawerContext.tsx';
import { getOsisRef } from './osisUtils.ts';
import { biblicalPlacesService } from '../../services/biblicalPlacesService.ts';
import { useStompMapFeatures } from '../../hooks/useStompMapFeatures.ts';
import { useStompPlaces } from '../../hooks/useStompPlaces.ts';

const pill = (active: boolean): React.CSSProperties => ({
  fontSize: 10, fontWeight: 700, letterSpacing: '0.3px',
  padding: '4px 10px', borderRadius: 99,
  border: `1.5px solid ${active ? '#C879FF' : '#dde0ee'}`,
  background: active ? '#C879FF' : 'rgba(247,248,252,0.88)',
  color: active ? '#fff' : '#888',
  cursor: 'pointer',
  backdropFilter: 'blur(6px)',
  transition: 'all 0.14s',
  whiteSpace: 'nowrap' as const,
});

export function BibleMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const ctrlRef      = useRef<SceneControls | null>(null);
  const { historicalDate, target } = useBibleDrawer();

  const { data: geoMaps } = useApi<GeoMap[]>('/api/geomap');

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

  const [projectionId, setProjectionId] = useState<string | null>(null);
  const { features: projectionFeatures } = useStompMapFeatures(projectionId);
  const [currentMapLabel, setCurrentMapLabel] = useState<string | null>(null);
  const [cam,          setCam]          = useState<CameraState | null>(null);
  const [dispScale,    setDispScale]    = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const ctrl = mountScene(containerRef.current, setCam);
    ctrlRef.current = ctrl;
    ctrl.setDisplacement(0);
    return ctrl.cleanup;
  }, []);

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

      {/* geojson projection selector */}
      <div style={{ display: 'flex', gap: 5, overflowX: 'auto', maxWidth: 340, paddingBottom: 2 }}>
          {geoMaps?.filter(gm => gm.id !== 'projection_countries').map(({ id, label }) => {
            const active = projectionId === id;
            return (
              <button
                key={id}
                onClick={() => {
                  const next = active ? null : id;
                  setProjectionId(next);
                  setCurrentMapLabel(next ? label : (bestMapId?.label ?? null));
                }}
                style={{
                  ...pill(false),
                  border: `1.5px solid ${active ? '#FFAA44' : '#dde0ee'}`,
                  background: active ? '#FFAA44' : 'rgba(247,248,252,0.88)',
                  color: active ? '#fff' : '#888',
                  flexShrink: 0,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

      </div>
  );
}
