import { useEffect, useMemo, useRef, useState } from 'react';
import { useCommentModalStore } from '@/store/commentModal.store.ts';
import type { PatristicCommentResult, PatristicCommentsPage } from '@/types/patristic.ts';
import atlasIndex from '@/data/atlas.json';
import { VerseRow } from './VerseRow.tsx';
import styles from './CommentModal.module.css';

const ATLAS_W   = 512;
const ATLAS_H   = 576;
const AVATAR_PX = 40;
const TILE_PX   = 64;
const SCALE     = AVATAR_PX / TILE_PX;
const MAX_CHARS = 100;

type SortMode = 'date' | 'alpha' | 'length';

type AtlasEntry = { x: number; y: number };
const atlas = atlasIndex as Record<string, AtlasEntry>;

function avatarStyle(slug: string): React.CSSProperties {
  const e = atlas[slug];
  return {
    backgroundImage:    `url('/atlas.png')`,
    backgroundSize:     `${ATLAS_W * SCALE}px ${ATLAS_H * SCALE}px`,
    backgroundPosition: `${-((e?.x ?? 0) * SCALE)}px ${-((e?.y ?? 0) * SCALE)}px`,
    backgroundRepeat:   'no-repeat',
  };
}

function CommentRow({ comment }: { comment: PatristicCommentResult }) {
  const [expanded, setExpanded] = useState(false);
  const text    = comment.text ?? '';
  const trimmed = text.length > MAX_CHARS && !expanded ? text.slice(0, MAX_CHARS) + '…' : text;

  return (
    <div className={styles.commentRow}>
      <a
        className={`${styles.avatar} ${comment.person.type === 'magistere' ? styles.avatarMag : styles.avatarPat}`}
        style={avatarStyle(comment.person.slug)}
        href={comment.sourceUrl || undefined}
        target="_blank"
        rel="noreferrer"
        title={comment.person.nameFr}
      />
      <div className={styles.commentBody}>
        <span className={styles.authorName}>{comment.person.nameFr}</span>
        {comment.person.born && comment.person.died && (
          <span className={styles.authorDates}>{comment.person.born}–{comment.person.died}</span>
        )}
        <p className={styles.commentText}>{trimmed}</p>
        {text.length > MAX_CHARS && (
          <button className={styles.seeMore} onClick={() => setExpanded(e => !e)}>
            {expanded ? 'voir moins' : 'voir plus'}
          </button>
        )}
        {comment.sourceUrl && (
          <a className={styles.sourceLink} href={comment.sourceUrl} target="_blank" rel="noreferrer">
            Source ↗
          </a>
        )}
      </div>
    </div>
  );
}

export function CommentModal() {
  const { target, close } = useCommentModalStore();

  const [verseIdx,     setVerseIdx]     = useState(0);
  const [rawComments,  setRawComments]  = useState<PatristicCommentResult[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [sort,         setSort]         = useState<SortMode>('date');
  const [filterSlug,   setFilterSlug]   = useState<string>('');

  // Sync internal index when target changes
  useEffect(() => {
    if (!target) return;
    setVerseIdx(target.verseIdx);
    setFilterSlug('');
  }, [target]);

  const verse = target?.verses?.[verseIdx] ?? null;

  // Fetch comments whenever current verse changes
  useEffect(() => {
    if (!verse) { setRawComments([]); return; }
    setLoading(true);
    fetch(`/api/patristic/verses/${verse.uuid}/comments?limit=100`)
      .then(r => r.json())
      .then((d: PatristicCommentsPage) => setRawComments(d.data ?? []))
      .catch(() => setRawComments([]))
      .finally(() => setLoading(false));
  }, [verse?.uuid]);

  // Close and reset if target is stale (old format without verses array)
  useEffect(() => {
    if (target && !Array.isArray(target.verses)) close();
  }, [target, close]);

  // Navigation
  const versesLen = target?.verses?.length ?? 0;
  const canPrev = versesLen > 0 && verseIdx > 0;
  const canNext = versesLen > 0 && verseIdx < versesLen - 1;

  const navigate = (delta: -1 | 1) => {
    const next = verseIdx + delta;
    if (next >= 0 && next < versesLen) {
      setVerseIdx(next);
      setFilterSlug('');
    }
  };

  // Keyboard ← →
  useEffect(() => {
    if (!target) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
      if (e.key === 'Escape')     close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [target, verseIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Authors list for filter dropdown
  const persons = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of rawComments) seen.set(c.person.slug, c.person.nameFr);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rawComments]);

  // Sort + filter — magistere always first within each sort
  const comments = useMemo(() => {
    let list = filterSlug ? rawComments.filter(c => c.person.slug === filterSlug) : rawComments;
    if (sort === 'alpha')  list = [...list].sort((a, b) => a.person.nameFr.localeCompare(b.person.nameFr));
    if (sort === 'length') list = [...list].sort((a, b) => b.text.length - a.text.length);
    if (sort === 'date')   list = [...list].sort((a, b) => (a.person.born ?? 9999) - (b.person.born ?? 9999));
    return [...list].sort((a, b) => (b.person.type === 'magistere' ? 1 : 0) - (a.person.type === 'magistere' ? 1 : 0));
  }, [rawComments, sort, filterSlug]);

  const verseRef = target && verse
    ? `${target.bookName} ${target.chapterNum}:${verse.number}`
    : '';

  if (!target || !target.verses?.length || !verse) return null;

  return (
    <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
      <div className={styles.panel}>

        <div className={styles.header}>
          <span className={styles.headerRef}>{verseRef}</span>
          <button className={styles.closeBtn} onClick={close} aria-label="Fermer">✕</button>
        </div>

        <div className={styles.columns}>

          {/* Left — verse + navigation */}
          <div className={styles.colVerse}>
            <button
              className={`${styles.navArrow} ${styles.navLeft}`}
              onClick={() => navigate(-1)}
              disabled={!canPrev}
              aria-label="Verset précédent"
            >‹</button>

            <div className={styles.verseContent}>
              <VerseRow key={verse.uuid} verse={verse} highlight={false} className={styles.verseRowInModal} />
              <div className={styles.commentCount}>
                {loading ? 'Chargement…' : `${rawComments.length} commentaire${rawComments.length > 1 ? 's' : ''}`}
              </div>
            </div>

            <button
              className={`${styles.navArrow} ${styles.navRight}`}
              onClick={() => navigate(1)}
              disabled={!canNext}
              aria-label="Verset suivant"
            >›</button>
          </div>

          {/* Right — toolbar + comments */}
          <div className={styles.colComments}>

            <div className={styles.toolbar}>
              <div className={styles.sortBtns}>
                {(['date', 'alpha', 'length'] as SortMode[]).map(s => (
                  <button
                    key={s}
                    className={`${styles.sortBtn} ${sort === s ? styles.sortBtnActive : ''}`}
                    onClick={() => setSort(s)}
                  >
                    {s === 'date' ? 'Date' : s === 'alpha' ? 'A–Z' : 'Longueur'}
                  </button>
                ))}
              </div>
              <select
                className={styles.filterSelect}
                value={filterSlug}
                onChange={e => setFilterSlug(e.target.value)}
              >
                <option value="">Tous les auteurs</option>
                {persons.map(([slug, name]) => (
                  <option key={slug} value={slug}>{name}</option>
                ))}
              </select>
            </div>

            <div className={styles.commentList}>
              {loading && <div className={styles.loader} />}
              {!loading && comments.length === 0 && (
                <p className={styles.empty}>Aucun commentaire disponible.</p>
              )}
              {!loading && (() => {
                const mag = comments.filter(c => c.person.type === 'magistere');
                const pat = comments.filter(c => c.person.type !== 'magistere');
                return (
                  <>
                    {mag.length > 0 && (
                      <>
                        <div className={`${styles.groupHeader} ${styles.groupHeaderMag}`}>
                          <div className={styles.groupLine} />
                          <span className={styles.groupLabel}>Magistère</span>
                          <div className={styles.groupLine} />
                        </div>
                        {mag.map(c => <CommentRow key={c.uuid} comment={c} />)}
                      </>
                    )}
                    {pat.length > 0 && (
                      <>
                        <div className={`${styles.groupHeader} ${styles.groupHeaderPat}`}>
                          <div className={styles.groupLine} />
                          <span className={styles.groupLabel}>Pères de l'Église</span>
                          <div className={styles.groupLine} />
                        </div>
                        {pat.map(c => <CommentRow key={c.uuid} comment={c} />)}
                      </>
                    )}
                  </>
                );
              })()}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
