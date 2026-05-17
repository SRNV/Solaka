import type { CommentSummary } from '@/models/patristic';
import atlasIndex from '@/data/atlas.json';
import styles from './VerseCommentBar.module.css';

const ATLAS_W     = 512;
const ATLAS_H     = 576;
const AVATAR_SIZE = 20;
const TILE_PX     = 64;
const scale       = AVATAR_SIZE / TILE_PX;

type AtlasEntry = { x: number; y: number; width: number; height: number };
const atlas = atlasIndex as Record<string, AtlasEntry>;

function avatarStyle(slug: string): React.CSSProperties {
  const entry = atlas[slug];
  const x = entry?.x ?? 0;
  const y = entry?.y ?? 0;
  return {
    backgroundImage:    `url('/atlas.png')`,
    backgroundSize:     `${ATLAS_W * scale}px ${ATLAS_H * scale}px`,
    backgroundPosition: `${-(x * scale)}px ${-(y * scale)}px`,
    backgroundRepeat:   'no-repeat',
  };
}

interface VerseCommentBarProps {
  summary:  CommentSummary;
  onClick?: () => void;
}

export function VerseCommentBar({ summary, onClick }: VerseCommentBarProps) {
  if (summary.count === 0) return null;
  return (
    <div
      className={`${styles.bar} ${onClick ? styles.clickable : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      <div className={styles.avatars}>
        {summary.persons.slice(0, 12).map(a => (
          <span
            key={a.slug}
            className={`${styles.avatar} ${a.type === 'magistere' ? styles.avatarMagistere : styles.avatarPatristic}`}
            style={avatarStyle(a.slug)}
            title={a.nameFr}
          />
        ))}
      </div>
      <span className={styles.count}>
        {summary.count} commentaire{summary.count > 1 ? 's' : ''}
      </span>
    </div>
  );
}
