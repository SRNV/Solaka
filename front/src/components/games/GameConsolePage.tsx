import { Suspense } from 'react';
import { useParams, Link } from 'react-router-dom';
import { GAME_REGISTRY } from '../../lib/games/src/components/games/GameRegistry.ts';

export function GameConsolePage() {
  const { slug, roomId } = useParams<{ slug: string; roomId: string }>();

  if (!slug || !roomId || !GAME_REGISTRY[slug]) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <h2>Jeu non trouvé</h2>
        <Link to="/games" style={{ color: 'var(--accent)' }}>← Retour aux jeux</Link>
      </div>
    );
  }

  const ConsoleComponent = GAME_REGISTRY[slug].console;

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 64px)', position: 'relative' }}>
      <Suspense fallback={<div style={{ padding: 20, color: 'var(--text-muted)' }}>Chargement…</div>}>
        <ConsoleComponent roomId={roomId} slug={slug} />
      </Suspense>
    </div>
  );
}
