import { Suspense, useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { PulseLoader } from 'react-spinners';
import { useControllerRoom } from '../../lib/games/src/hooks/useControllerRoom.ts';
import { usePseudo } from '../../lib/games/src/hooks/usePseudo.ts';
import { GAME_REGISTRY } from '../../lib/games/src/components/games/GameRegistry.ts';
import { findTheme } from '../../lib/games/src/components/gamepad3d/themes.ts';
import { PseudoModal } from './PseudoModal.tsx';
import styles from './GameRoomPage.module.css';

export function GameRoomPage() {
  const { slug, roomId } = useParams<{ slug: string; roomId: string }>();
  const { pseudo, setPseudo } = usePseudo();
  const [pseudoConfirmed, setPseudoConfirmed] = useState(false);
  const [pendingPseudo, setPendingPseudo] = useState(pseudo);

  const theme = useMemo(() => {
    const saved = localStorage.getItem('gamepad_theme') || 'default';
    return findTheme(saved);
  }, []);

  const { phase, status, registered, error, controllerId, isMaster, clearError } =
    useControllerRoom(roomId!, pendingPseudo, pseudoConfirmed);

  // Fullscreen when game starts
  useEffect(() => {
    if (phase !== 'playing') return;
    const el = document.documentElement;
    const req = (el.requestFullscreen ?? (el as any).webkitRequestFullscreen)?.bind(el);
    req?.({ navigationUI: 'hide' } as any).catch(() => {});
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [phase]);

  function handlePseudoConfirm(name: string) {
    setPseudo(name);
    setPendingPseudo(name);
    clearError();
    setPseudoConfirmed(true);
  }

  // Pseudo taken: let user pick another
  const pseudoError = error?.includes('Pseudo') || error?.includes('pseudo') ? error : null;
  if (pseudoError && pseudoConfirmed) {
    return (
      <PseudoModal
        initialPseudo={pendingPseudo}
        error={pseudoError}
        onConfirm={handlePseudoConfirm}
      />
    );
  }

  // Show pseudo modal on first entry (not confirmed yet)
  if (!pseudoConfirmed) {
    return (
      <PseudoModal
        initialPseudo={pseudo}
        onConfirm={handlePseudoConfirm}
      />
    );
  }

  // Fatal error (room not found, closed)
  if (error && !pseudoError) {
    return (
      <div className={styles.center}>
        <div className={styles.card}>
          <p className={styles.error}>{error}</p>
        </div>
      </div>
    );
  }

  const entry = slug ? GAME_REGISTRY[slug] : null;

  if (registered && entry) {
    const ControllerComponent = entry.controller;
    return (
      <div className={styles.center}>
        <Suspense fallback={<div className={styles.spinner} />}>
          <ControllerComponent
            roomId={roomId!}
            controllerId={controllerId}
            active={phase === 'playing'}
            isMaster={isMaster}
          />
        </Suspense>
      </div>
    );
  }

  const statusLabel =
    status === 'reconnecting' ? 'Reconnexion…' :
    registered ? 'En attente du démarrage…' : 'Connexion…';

  return (
    <div className={styles.center} style={{ backgroundColor: theme.bg }}>
      <div className={styles.card}>
        <p className={styles.game}>{slug}</p>
        <div className={styles.spinner}>
          <PulseLoader color={theme.outlineColor} size={15} margin={5} />
        </div>
        <p className={styles.label}>{statusLabel}</p>
        {status === 'reconnecting' && (
          <p className={styles.reconnectNote}>
            Tentative de reconnexion automatique…
          </p>
        )}
      </div>
    </div>
  );
}
