import { useToastStore } from '@/store/toast.store';
import styles from './ToastContainer.module.css';

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();
  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map(t => (
        <div key={t.id} className={styles.toast}>
          <span className={styles.msg}>{t.message}</span>
          <button className={styles.close} onClick={() => removeToast(t.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}
