import styles from './GraphPage.module.css';

interface Props {
  showCath:      boolean;
  showProt:      boolean;
  showPulse:     boolean;
  hasFilter:     boolean;
  onToggleCath:  () => void;
  onToggleProt:  () => void;
  onTogglePulse: () => void;
  onClearFilter: () => void;
}

export function TraditionPills({
  showCath, showProt, showPulse, hasFilter,
  onToggleCath, onToggleProt, onTogglePulse, onClearFilter,
}: Props) {
  return (
    <div className={styles.controls}>
      <button
        className={`${styles.pill} ${styles.pillSm} ${showCath ? styles.pillCathActive : ''}`}
        onClick={onToggleCath}
      >Catholique</button>
      <button
        className={`${styles.pill} ${styles.pillSm} ${showProt ? styles.pillProtActive : ''}`}
        onClick={onToggleProt}
      >Protestant</button>
      <button
        className={`${styles.pill} ${styles.pillSm} ${showPulse ? styles.pillActive : ''}`}
        onClick={onTogglePulse}
      >Pulse</button>
      {hasFilter && (
        <button className={`${styles.pill} ${styles.pillSm}`} onClick={onClearFilter}>
          ✕ Filtre
        </button>
      )}
    </div>
  );
}
