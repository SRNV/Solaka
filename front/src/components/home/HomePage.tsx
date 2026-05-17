import styles from './HomePage.module.css';

interface Section { id: string; label: string; emoji: string; desc: string; color: string; }

const SECTIONS: Section[] = [
  { id: 'objections', label: 'Objections', emoji: '⚖',  desc: 'Réponses catholiques aux objections protestantes et islamiques', color: 'var(--primary)' },
  { id: 'references', label: 'Références', emoji: '📖', desc: 'Versets scripturaires organisés par sujet',                       color: 'var(--success)' },
  { id: 'sources',    label: 'Sources',    emoji: '✦',  desc: 'Tradition catholique, Pères de l\'Église, Conciles',              color: 'var(--warning)' },
];

export function HomePage() {
  return (
    <div>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.title}>SolaKa</h1>

          <p className={styles.subtitle}>
            Réponses fondées sur l'Écriture et la Tradition aux objections
            formulées contre la foi catholique.
          </p>

          <div className={styles.cta}>
            <a href="/objections" className={styles.ctaPrimary}>
              Voir les objections →
            </a>
          </div>
        </div>

        <div className={styles.scrollHint}>
          <span>↓</span>
        </div>
      </section>

      <section className={styles.explore}>
        <h2 className={styles.exploreTitle}>Explorer</h2>

        <div className={styles.grid}>
          {SECTIONS.map(s => (
            <a key={s.id} href={`/${s.id}`} className={styles.card}>
              <div
                className={styles.cardIcon}
                style={{ background: `color-mix(in srgb, ${s.color} 15%, transparent)` }}
              >
                {s.emoji}
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardLabel}>{s.label}</div>
                <div className={styles.cardDesc}>{s.desc}</div>
              </div>
              <div className={styles.cardLink} style={{ color: s.color }}>
                Explorer →
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
