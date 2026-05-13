import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin, ViteDevServer } from 'vite';

const virtualCssPath = '/@virtual:ssr-css.css';

function pluginSsrDevFoucFix(): Plugin {
  const collectedStyles = new Map<string, string>();
  let server: ViteDevServer;

  return {
    name: 'ssr-dev-FOUC-fix',
    apply: 'serve',
    transform(code: string, id: string) {
      if (id.includes('node_modules')) return null;
      if (id.includes('.css')) collectedStyles.set(id, code);
      return null;
    },
    configureServer(server_) {
      server = server_;
      server.middlewares.use((req, res, next) => {
        if ((req as any).url === virtualCssPath) {
          res.setHeader('Content-Type', 'text/css');
          res.write(Array.from(collectedStyles.values()).join('\n'));
          res.end();
          return;
        }
        next();
      });
    },
    transformIndexHtml: {
      handler: async () => [
        { tag: 'link', injectTo: 'head', attrs: { rel: 'stylesheet', href: virtualCssPath } },
      ],
    },
  };
}

export default defineConfig({
  plugins: [react(), pluginSsrDevFoucFix()],
  resolve: { alias: { '@': '/src' } },
  // Keep Vite's esbuild dep cache inside node_modules (named Docker volume) so it survives restarts
  cacheDir: 'node_modules/.vite',

  // Pré-bundle les libs lourdes au démarrage du serveur dev
  // → évite la transformation à la demande sur le premier chargement
  optimizeDeps: {
    // Ne pas bloquer les requêtes navigateur pendant le crawl initial
    // (tous les deps npm sont listés explicitement → aucun risque de re-optimisation surprise)
    holdUntilCrawlEnd: false,
    include: [
      'three',
      'three/addons/controls/OrbitControls.js',
      '@react-three/fiber',
      '@react-three/drei',
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'zustand',
      '@stomp/stompjs',
    ],
  },

  css: {
    transformer: 'lightningcss',
  },
  build: {
    cssMinify: 'lightningcss',
  },
  server: {
    host:  '0.0.0.0',
    port:  5173,
    // Polling obligatoire pour HMR dans Docker, mais intervalle long pour réduire
    // la contention I/O avec le bind mount Windows→WSL2 pendant les transforms
    watch: { usePolling: true, interval: 3000 },
    proxy: {
      '/api':   { target: 'http://back:3001', changeOrigin: true },
      '/stomp': { target: 'ws://back:3001',   ws: true },
    },
    warmup: {
      clientFiles: [
        './src/App.tsx',
        './src/main.tsx',
        './src/components/layout/Layout.tsx',
        './src/components/graph/GraphPage.tsx',
        './src/lib/BibleMap/BibleMap.tsx',
        './src/lib/BibleMap/scene.ts',
        './src/components/bible/BibleDrawer.tsx',
        './src/styles/globals.css',
      ],
    },
  },
});
