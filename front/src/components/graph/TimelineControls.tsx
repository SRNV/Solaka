import styles from './TimelineControls.module.css';

const SPEEDS = [0.5, 1, 2, 5];

interface Props {
  isPlaying:    boolean;
  playSpeed:    number;
  isHistorical: boolean;
  onTogglePlay: () => void;
  onSpeedChange:(s: number) => void;
  onClose:      () => void;
}

export function TimelineControls({
  isPlaying, playSpeed, isHistorical,
  onTogglePlay, onSpeedChange, onClose,
}: Props) {
  return (
    <div className={styles.bar}>
      <button className={styles.playBtn} onClick={onTogglePlay} title={isPlaying ? 'Pause' : 'Play'}>
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      {isHistorical && (
        <>
          <div className={styles.speeds}>
            {SPEEDS.map(s => (
              <button
                key={s}
                className={`${styles.speedBtn} ${playSpeed === s ? styles.speedActive : ''}`}
                onClick={() => onSpeedChange(s)}
              >
                {s}×
              </button>
            ))}
          </div>

          <button className={styles.closeBtn} onClick={onClose} title="Retour au mode classique">
            ✕
          </button>
        </>
      )}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <polygon points="6,3 20,12 6,21" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <rect x="5"  y="4" width="4.5" height="16" rx="1" />
      <rect x="14" y="4" width="4.5" height="16" rx="1" />
    </svg>
  );
}
