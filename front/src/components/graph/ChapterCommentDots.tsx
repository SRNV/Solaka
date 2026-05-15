import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { usePatristicCommentStore } from '@/store/comment.store.ts';
import type { LayoutResult } from '@/utils/graphLayout.ts';
import styles from './ChapterCommentDots.module.css';

function authorColor(slug: string): string {
  let h = 0;
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return `hsl(${h % 360}, 55%, 48%)`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

interface ChapterCommentDotsProps {
  layout: LayoutResult;
}

export function ChapterCommentDots({ layout }: ChapterCommentDotsProps) {
  const summaries = usePatristicCommentStore(s => s.summaries);

  const dots = useMemo(() => {
    const result: { uuid: string; pos: { x: number; y: number; z: number }; topAuthorSlug: string; topAuthorName: string; count: number }[] = [];
    for (const [uuid, summary] of summaries) {
      if (summary.count === 0) continue;
      const pos = layout.uuidPosMap.get(uuid);
      if (!pos) continue;
      const top = summary.authors[0];
      result.push({
        uuid,
        pos,
        topAuthorSlug: top?.slug ?? '',
        topAuthorName: top?.nameFr ?? '',
        count:         summary.count,
      });
    }
    return result;
  }, [summaries, layout.uuidPosMap]);

  return (
    <>
      {dots.map(({ uuid, pos, topAuthorSlug, topAuthorName, count }) => (
        <Html
          key={uuid}
          position={[pos.x, pos.y + 0.45, pos.z + 0.1]}
          center
          zIndexRange={[60, 60]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            className={styles.dot}
            style={{ background: topAuthorSlug ? authorColor(topAuthorSlug) : '#6b7280' }}
            title={`${topAuthorName} · ${count} commentaire${count > 1 ? 's' : ''}`}
          >
            {topAuthorName ? initials(topAuthorName) : '?'}
          </div>
        </Html>
      ))}
    </>
  );
}
