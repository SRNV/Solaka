/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GAME_HOST?: string;
  readonly VITE_GAMES_STOMP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}
declare module '*.jpeg' {
  const src: string;
  export default src;
}
declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
