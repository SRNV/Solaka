import { useEffect, useState } from 'react';
import type { BibleRelation, BibleBookMeta } from '@/models/bible';
import type { LayoutResult } from '@/models/graph';
import type { PanelData } from './HoverPanel';
import { useHoverContent } from './useHoverContent';

export function useHoverPanel(layout: LayoutResult | null, books: BibleBookMeta[] | null) {
  const [hoveredBook,     setHoveredBook]     = useState<string | null>(null);
  const [hoveredArcXs,    setHoveredArcXs]    = useState<Set<number> | null>(null);
  const [hoveredRel,      setHoveredRel]      = useState<BibleRelation | null>(null);
  const [hoveredCubeUuid, setHoveredCubeUuid] = useState<string | null>(null);
  const [panelData,       setPanelData]       = useState<PanelData | null>(null);

  const { hoveredVerses, hoveredCubeVerse, hoveredCubeSummary } = useHoverContent(hoveredRel, hoveredCubeUuid, layout);

  useEffect(() => { if (hoveredRel)                  setPanelData({ type: 'arc',  rel: hoveredRel, verses: null }); },               [hoveredRel]);
  useEffect(() => { if (hoveredVerses)               setPanelData(p => p?.type === 'arc'  ? { ...p, verses: hoveredVerses } : p); }, [hoveredVerses]);
  useEffect(() => { if (hoveredCubeUuid)             setPanelData({ type: 'cube', uuid: hoveredCubeUuid, verse: null, summary: null }); }, [hoveredCubeUuid]);
  useEffect(() => { if (hoveredCubeVerse)            setPanelData(p => p?.type === 'cube' ? { ...p, verse: hoveredCubeVerse } : p); }, [hoveredCubeVerse]);
  useEffect(() => { if (hoveredCubeSummary !== null) setPanelData(p => p?.type === 'cube' ? { ...p, summary: hoveredCubeSummary } : p); }, [hoveredCubeSummary]);
  useEffect(() => {
    if (hoveredBook && books) {
      const book = books.find(b => b.name === hoveredBook);
      if (book) setPanelData({ type: 'book', book });
    }
  }, [hoveredBook, books]);

  return {
    hoveredBook,     setHoveredBook,
    hoveredArcXs,    setHoveredArcXs,
    hoveredRel,      setHoveredRel,
    hoveredCubeUuid, setHoveredCubeUuid,
    panelData,       setPanelData,
    effectiveHoveredBook: hoveredArcXs ? null : hoveredBook,
  };
}
