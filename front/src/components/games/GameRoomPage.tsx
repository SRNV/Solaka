import { Suspense, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useControllerRoom } from '../../lib/games/src/hooks/useControllerRoom.ts';
import { GAME_REGISTRY } from '../../lib/games/src/components/games/GameRegistry.ts';
import styles from './GameRoomPage.module.css';

export function GameRoomPage() {
  const { slug, roomId } = useParams<{ slug: string; roomId: string }>();
  const { phase, registered, error, controllerId } = useControllerRoom(roomId!);

  useEffect(() => {
    if (phase !== 'playing') return;
    const el = document.documentElement;
    const req = (el.requestFullscreen ?? (el as any).webkitRequestFullscreen)?.bind(el);
    req?.({ navigationUI: 'hide' } as any).catch(() => {});
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [phase]);

  if (error) {
    return (
      <div className={styles.center}>
        <p className={styles.error}>{error}</p>
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
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className={styles.center}>
      <div className={styles.card}>
        <p className={styles.game}>{slug}</p>
        <div className={styles.spinner} />
        <p className={styles.label}>
          {registered ? 'En attente du démarrage…' : 'Connexion…'}
        </p>
      </div>
    </div>
  );
}
