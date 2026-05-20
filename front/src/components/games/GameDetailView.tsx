import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GAME_REGISTRY } from '../../lib/games/src/components/games/GameRegistry.ts';
import { randomUUID } from '../../lib/games/src/uuid.ts';

/**
 * Crée la room immédiatement et redirige vers la console avec le roomId dans l'URL.
 * L'utilisateur atterrit directement sur la page avec QR code + compteur de manettes.
 */
export function GameDetailView() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !slug || !GAME_REGISTRY[slug]) return;
    started.current = true;

    const roomId = randomUUID();
    fetch('/games-api/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, slug }),
    })
      .then(res => {
        if (!res.ok) throw new Error('Impossible de créer la partie.');
        navigate(`/games/${slug}/console/${roomId}`, { replace: true });
      })
      .catch(() => {
        // Even on error, try to navigate — GameConsolePage handles room-not-found
        navigate(`/games/${slug}/console/${roomId}`, { replace: true });
      });
  }, [slug]);

  if (!slug || !GAME_REGISTRY[slug]) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <h2>Jeu non trouvé</h2>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 64px)' }}>
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
        <div style={{
          width: 36, height: 36, border: '3px solid #2a2a2a', borderTopColor: '#D4AC0D',
          borderRadius: '50%', animation: 'spin 0.9s linear infinite', margin: '0 auto 1rem',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p>Création de la partie…</p>
      </div>
    </div>
  );
}
