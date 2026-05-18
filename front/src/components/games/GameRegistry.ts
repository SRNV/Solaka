import { lazy, LazyExoticComponent, ComponentType } from 'react';

// Type pour nos composants de jeux
export type GameComponent = LazyExoticComponent<ComponentType<any>>;

// Le Registry mappe les slugs du serveur aux imports dynamiques
export const GAME_REGISTRY: Record<string, GameComponent> = {
  'first-game': lazy(() => import('../../lib/games/FirstGame')),
  'bible-quiz': lazy(() => import('../../lib/games/BibleQuiz')),
};
