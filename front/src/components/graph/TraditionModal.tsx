import styles from './TraditionModal.module.css';

interface TraditionModalProps {
  traditions: string[];
  onConfirm:  () => void;
  onDismiss:  () => void;
}

export function TraditionModal({ traditions, onConfirm, onDismiss }: TraditionModalProps) {
  return (
    <div className={styles.modalOverlay} onClick={onDismiss}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <p className={styles.modalTitle}>Traditions masquées</p>
        <p className={styles.modalText}>
          {traditions.length === 1
            ? `Ce passage contient des relations de tradition ${traditions[0]}, actuellement masquée. Souhaitez-vous l'afficher ?`
            : `Ce passage contient des relations de traditions ${traditions.join(' et ')}, actuellement masquées. Souhaitez-vous les afficher ?`}
        </p>
        <div className={styles.modalActions}>
          <button className={styles.modalCancel}  onClick={onDismiss}>Ignorer</button>
          <button className={styles.modalConfirm} onClick={onConfirm}>Afficher</button>
        </div>
      </div>
    </div>
  );
}
