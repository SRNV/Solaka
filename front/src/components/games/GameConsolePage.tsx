import { Suspense, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { GAME_REGISTRY } from '../../lib/games/src/components/games/GameRegistry.ts';
import { DebugOverlay } from './DebugOverlay.tsx';

function getRoomId(slug: string, urlRoomId: string): string {
  const key = `${slug}-room-id`;
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) return stored;
    sessionStorage.setItem(key, urlRoomId);
  } catch { /* sessionStorage unavailable */ }
  return urlRoomId;
}

export function GameConsolePage() {
  const { slug, roomId } = useParams<{ slug: string; roomId: string }>();

  const [effectiveRoomId] = useState(() => {
    if (!slug || !roomId) return roomId ?? '';
    return getRoomId(slug, roomId);
  });

  const onRoomClosed = useCallback(() => {
    if (!slug) return;
    try { sessionStorage.removeItem(`${slug}-room-id`); } catch { /* ignore */ }
  }, [slug]);

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
        <ConsoleComponent roomId={effectiveRoomId} slug={slug} onRoomClosed={onRoomClosed} />
      </Suspense>
      {import.meta.env.DEV && <DebugOverlay roomId={effectiveRoomId} />}
    </div>
  );
}
