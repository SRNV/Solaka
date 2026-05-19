import { useEffect, useState } from 'react';
import { GamesSelectorCard } from './GamesSelectorCard.tsx';
import styles from './GamesPage.module.css';

interface GameInfo {
  title: string;
  description: string;
  slug: string;
  image?: string;
}

export function GamesPage() {
  const [games, setGames] = useState<GameInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/games-api/api/games')
      .then(res => res.json())
      .then(data => {
        setGames(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch games:', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>Jeux</h2>
        <p className={styles.description}>jouer pour mieux connaitre Dieu, c'est possible</p>
      </div>
      <div className={styles.content}>
        {loading ? (
          <p>Chargement des jeux...</p>
        ) : games.length > 0 ? (
          <div className={styles.grid}>
            {games.map(game => (
              <GamesSelectorCard 
                key={game.slug}
                data={game}
              />
            ))}
          </div>
        ) : (
          <p>Aucun jeu disponible pour le moment.</p>
        )}
      </div>
    </div>
  );
}
