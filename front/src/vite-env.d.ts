/// <reference types="vite/client" />

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
