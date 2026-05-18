import { useNavigate } from 'react-router-dom';
import styles from './GamesSelectorCard.module.css';

interface GameData {
  title: string;
  description: string;
  image?: string;
  slug: string;
}

interface GamesSelectorCardProps {
  data: GameData;
}

export function GamesSelectorCard({ data }: GamesSelectorCardProps) {
  const navigate = useNavigate();
  const { title, description, image, slug } = data;

  return (
    <div className={styles.card} onClick={() => navigate(`/games/${slug}`)}>
      <div className={styles.imagePlaceholder}>
        {image ? <img src={image} alt={title} className={styles.image} /> : <span className={styles.imageIcon}>🎮</span>}
      </div>
      <div className={styles.content}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
      </div>
    </div>
  );
}
