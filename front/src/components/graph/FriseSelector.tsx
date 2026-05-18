import styles from './GraphPage.module.css';
import type { FriseType } from '@/store/graphMode.store';
export type { FriseType };

const LABELS: Record<FriseType, string> = { kings: 'Rois', periods: 'Périodes', events: 'Événements' };

interface Props {
  value:    FriseType;
  onChange: (v: FriseType) => void;
}

export function FriseSelector({ value, onChange }: Props) {
  return (
    <div className={styles.friseSelector}>
      {(Object.keys(LABELS) as FriseType[]).map(val => (
        <button
          key={val}
          className={`${styles.sortBtn} ${value === val ? styles.sortBtnActive : ''}`}
          onClick={() => onChange(val)}
        >{LABELS[val]}</button>
      ))}
    </div>
  );
}
