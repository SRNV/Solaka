import type { BookSortMode, HistoricalSubMode } from '@/models/bible';
import styles from './GraphPage.module.css';

const SORT_LABELS: Record<BookSortMode, string> = {
  classic:    'Classique',
  historical: 'Historique',
  size:       'Taille',
};

const HIST_SUB_LABELS: Record<HistoricalSubMode, string> = {
  authorPeriod:    'Période auteur',
  mainComposition: 'Composition',
  finalRedaction:  'Rédaction finale',
};

interface Props {
  sortMode:      BookSortMode;
  histSubMode:   HistoricalSubMode;
  onSortMode:    (m: BookSortMode) => void;
  onHistSubMode: (m: HistoricalSubMode) => void;
}

export function SortPanel({ sortMode, histSubMode, onSortMode, onHistSubMode }: Props) {
  return (
    <div className={styles.sortPanel}>
      {sortMode === 'historical' && (
        <div className={styles.histDropup}>
          {(Object.keys(HIST_SUB_LABELS) as HistoricalSubMode[]).map(sub => (
            <button
              key={sub}
              className={`${styles.sortBtn} ${histSubMode === sub ? styles.sortBtnActive : ''}`}
              onClick={() => onHistSubMode(sub)}
            >{HIST_SUB_LABELS[sub]}</button>
          ))}
        </div>
      )}
      <span className={styles.sortLabel}>Ordre</span>
      {(Object.keys(SORT_LABELS) as BookSortMode[]).map(mode => (
        <button
          key={mode}
          className={`${styles.sortBtn} ${sortMode === mode ? styles.sortBtnActive : ''}`}
          onClick={() => onSortMode(mode)}
        >{SORT_LABELS[mode]}</button>
      ))}
    </div>
  );
}
