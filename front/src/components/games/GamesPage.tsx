import styles from './GamesPage.module.css';

export function GamesPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>Jeux</h2>
        <p className={styles.description}>jouer pour mieux connaitre Dieu, c'est possible</p>
      </div>
      <div className={styles.content}>
        <p className={styles.placeholder}>Section à venir.</p>
      </div>
    </div>
  );
}
