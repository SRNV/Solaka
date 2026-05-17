import { useEffect, useState } from 'react';
import type { BibleRelation } from '@/models/bible';
import type { LayoutResult } from '@/models/graph';

interface HoveredVerses {
  from: string; fromSummary: string;
  to:   string; toSummary:   string;
}

export function useHoverContent(
  hoveredRel:      BibleRelation | null,
  hoveredCubeUuid: string | null,
  layout:          LayoutResult | null,
) {
  const [hoveredVerses,      setHoveredVerses]      = useState<HoveredVerses | null>(null);
  const [hoveredCubeVerse,   setHoveredCubeVerse]   = useState<string | null>(null);
  const [hoveredCubeSummary, setHoveredCubeSummary] = useState<string | null>(null);

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

  return { hoveredVerses, hoveredCubeVerse, hoveredCubeSummary };
}
