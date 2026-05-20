import { useState } from 'react';
import styles from './PseudoModal.module.css';

interface Props {
  initialPseudo: string;
  error?: string | null;
  onConfirm: (pseudo: string) => void;
}

export function PseudoModal({ initialPseudo, error, onConfirm }: Props) {
  const [value, setValue] = useState(initialPseudo);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onConfirm(trimmed);
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.card}>
        <h2 className={styles.title}>Rejoindre la partie</h2>
        <p className={styles.subtitle}>Choisissez un pseudo visible par les autres joueurs</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            className={styles.input}
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Votre pseudo"
            maxLength={24}
            autoFocus
          />
          {error && <p className={styles.error}>{error}</p>}
          <button
            className={styles.btn}
            type="submit"
            disabled={!value.trim()}
          >
            Rejoindre
          </button>
        </form>
      </div>
    </div>
  );
}
