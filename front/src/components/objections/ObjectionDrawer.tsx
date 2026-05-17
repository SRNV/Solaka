import { createPortal } from 'react-dom';
import type { Objection, Reference } from '@/models/api';
import { useBibleDrawer } from '@/contexts/BibleDrawerContext.tsx';
import styles from './ObjectionDrawer.module.css';

function refLabel(ref: Reference): string {
  if (ref.from === 0) return `${ref.name} ${ref.chapter}`;
  const range = ref.from === ref.to ? `${ref.from}` : `${ref.from}–${ref.to}`;
  return `${ref.name} ${ref.chapter}:${range}`;
}

/**
 * Group refs first by explicit `group` field, then by identical summary
 * (catches pairs the migration missed).
 */
function groupRefs(refs: Reference[]): Reference[][] {
  const map = new Map<string, Reference[]>();
  let solo = 0;
  for (const ref of refs) {
    let key: string;
    if (ref.group != null)  key = `g:${ref.group}`;
    else if (ref.summary)   key = `d:${ref.summary}`;
    else                    key = `u:${solo++}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ref);
  }
  return Array.from(map.values());
}

interface Props {
  objection: Objection;
  onClose: () => void;
}

export function ObjectionDrawer({ objection, onClose }: Props) {
  const target = document.getElementById('layout-main');
  const { open: openBible } = useBibleDrawer();

  if (!target) return null;

  const cards = groupRefs(objection.references)
    .sort((a, b) => (b[0].rank ?? 2) - (a[0].rank ?? 2));

  function openRef(ref: Reference) {
    openBible({
      book:    ref.name,
      chapter: ref.chapter,
      verse:   ref.from !== 0 ? ref.from : undefined,
      verseTo: ref.from !== 0 && ref.to !== ref.from ? ref.to : undefined,
    });
  }

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />

      <aside className={styles.drawer}>
        <div className={styles.drawerHeader}>
          <button className={styles.closeBtn} onClick={onClose} title="Fermer">✕</button>
          <span className={styles.drawerTitle}>{objection.category.name}</span>
          <span className={`${styles.badge} ${objection.category.from === 'islam' ? styles.badgeIslam : styles.badgeProtestant}`}>
            {objection.category.from}
          </span>
        </div>

        <div className={styles.drawerBody}>
          <h2 className={styles.objName}>{objection.name}</h2>

          {objection.description && (
            <p className={styles.description}>{objection.description}</p>
          )}

          {cards.length > 0 && (
            <>
              <p className={styles.refsTitle}>Réponses scripturaires</p>
              <div className={styles.refs}>
                {cards.map((group, i) => {
                  const rank    = group[0].rank ?? 2;
                  const summary = group.find(r => r.summary)?.summary ?? '';
                  return (
                    <div key={i} className={styles.refItem} data-rank={rank}>
                      <div className={styles.refTop}>
                        <div className={styles.refBadges}>
                          {group.map((ref, j) => (
                            <span key={j} className={styles.refBadgeWrap}>
                              {j > 0 && <span className={styles.refSep}>+</span>}
                              <button
                                className={styles.refBadge}
                                onClick={() => openRef(ref)}
                              >
                                {refLabel(ref)}
                              </button>
                            </span>
                          ))}
                        </div>
                        <span className={styles.stars}>{'⭐'.repeat(rank)}</span>
                      </div>
                      {summary && <p className={styles.refSummary}>{summary}</p>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </aside>
    </>,
    target,
  );
}
