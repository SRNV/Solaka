import { useParams } from 'react-router-dom';
import { Suspense } from 'react';
import { GAME_REGISTRY } from '../../lib/games/src/components/games/GameRegistry';

export function GameDetailView() {
  const { slug } = useParams<{ slug: string }>();
  
  if (!slug || !GAME_REGISTRY[slug]) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>Jeu non trouvé</h2>
        <p>Le jeu "{slug}" n'existe pas ou n'est pas encore implémenté.</p>
      </div>
    );
  }

  const GameComponent = GAME_REGISTRY[slug];

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 64px)', position: 'relative' }}>
      <Suspense fallback={<div style={{ padding: 20 }}>Chargement du moteur de jeu...</div>}>
        <GameComponent />
      </Suspense>
    </div>
  );
}
