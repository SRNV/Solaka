// vite.config.ts
import { defineConfig } from "file:///app/node_modules/vite/dist/node/index.js";
import react from "file:///app/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": "/src" } },
  // Keep Vite's esbuild dep cache inside node_modules (named Docker volume) so it survives restarts
  cacheDir: "node_modules/.vite",
  // Pré-bundle les libs lourdes au démarrage du serveur dev
  // → évite la transformation à la demande sur le premier chargement
  optimizeDeps: {
    include: [
      "three",
      "three/addons/controls/OrbitControls.js",
      "@react-three/fiber",
      "@react-three/drei",
      "react",
      "react-dom",
      "react-router-dom"
    ]
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    watch: { usePolling: true },
    proxy: {
      "/api": { target: "http://back:3001", changeOrigin: true },
      "/stomp": { target: "ws://back:3001", ws: true }
    },
    // Pré-transforme les fichiers fréquents dès le démarrage
    warmup: {
      clientFiles: [
        "./src/main.tsx",
        "./src/App.tsx",
        "./src/components/graph/GraphPage.tsx",
        "./src/lib/BibleMap/BibleMap.tsx",
        "./src/lib/BibleMap/scene.ts",
        "./src/components/bible/BibleDrawer.tsx"
      ]
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvYXBwL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcbiAgcmVzb2x2ZTogeyBhbGlhczogeyAnQCc6ICcvc3JjJyB9IH0sXG4gIC8vIEtlZXAgVml0ZSdzIGVzYnVpbGQgZGVwIGNhY2hlIGluc2lkZSBub2RlX21vZHVsZXMgKG5hbWVkIERvY2tlciB2b2x1bWUpIHNvIGl0IHN1cnZpdmVzIHJlc3RhcnRzXG4gIGNhY2hlRGlyOiAnbm9kZV9tb2R1bGVzLy52aXRlJyxcblxuICAvLyBQclx1MDBFOS1idW5kbGUgbGVzIGxpYnMgbG91cmRlcyBhdSBkXHUwMEU5bWFycmFnZSBkdSBzZXJ2ZXVyIGRldlxuICAvLyBcdTIxOTIgXHUwMEU5dml0ZSBsYSB0cmFuc2Zvcm1hdGlvbiBcdTAwRTAgbGEgZGVtYW5kZSBzdXIgbGUgcHJlbWllciBjaGFyZ2VtZW50XG4gIG9wdGltaXplRGVwczoge1xuICAgIGluY2x1ZGU6IFtcbiAgICAgICd0aHJlZScsXG4gICAgICAndGhyZWUvYWRkb25zL2NvbnRyb2xzL09yYml0Q29udHJvbHMuanMnLFxuICAgICAgJ0ByZWFjdC10aHJlZS9maWJlcicsXG4gICAgICAnQHJlYWN0LXRocmVlL2RyZWknLFxuICAgICAgJ3JlYWN0JyxcbiAgICAgICdyZWFjdC1kb20nLFxuICAgICAgJ3JlYWN0LXJvdXRlci1kb20nLFxuICAgIF0sXG4gIH0sXG5cbiAgc2VydmVyOiB7XG4gICAgaG9zdDogICcwLjAuMC4wJyxcbiAgICBwb3J0OiAgNTE3MyxcbiAgICB3YXRjaDogeyB1c2VQb2xsaW5nOiB0cnVlIH0sXG4gICAgcHJveHk6IHtcbiAgICAgICcvYXBpJzogICB7IHRhcmdldDogJ2h0dHA6Ly9iYWNrOjMwMDEnLCBjaGFuZ2VPcmlnaW46IHRydWUgfSxcbiAgICAgICcvc3RvbXAnOiB7IHRhcmdldDogJ3dzOi8vYmFjazozMDAxJywgICB3czogdHJ1ZSB9LFxuICAgIH0sXG4gICAgLy8gUHJcdTAwRTktdHJhbnNmb3JtZSBsZXMgZmljaGllcnMgZnJcdTAwRTlxdWVudHMgZFx1MDBFOHMgbGUgZFx1MDBFOW1hcnJhZ2VcbiAgICB3YXJtdXA6IHtcbiAgICAgIGNsaWVudEZpbGVzOiBbXG4gICAgICAgICcuL3NyYy9tYWluLnRzeCcsXG4gICAgICAgICcuL3NyYy9BcHAudHN4JyxcbiAgICAgICAgJy4vc3JjL2NvbXBvbmVudHMvZ3JhcGgvR3JhcGhQYWdlLnRzeCcsXG4gICAgICAgICcuL3NyYy9saWIvQmlibGVNYXAvQmlibGVNYXAudHN4JyxcbiAgICAgICAgJy4vc3JjL2xpYi9CaWJsZU1hcC9zY2VuZS50cycsXG4gICAgICAgICcuL3NyYy9jb21wb25lbnRzL2JpYmxlL0JpYmxlRHJhd2VyLnRzeCcsXG4gICAgICBdLFxuICAgIH0sXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBOEwsU0FBUyxvQkFBb0I7QUFDM04sT0FBTyxXQUFXO0FBRWxCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUNqQixTQUFTLEVBQUUsT0FBTyxFQUFFLEtBQUssT0FBTyxFQUFFO0FBQUE7QUFBQSxFQUVsQyxVQUFVO0FBQUE7QUFBQTtBQUFBLEVBSVYsY0FBYztBQUFBLElBQ1osU0FBUztBQUFBLE1BQ1A7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBRUEsUUFBUTtBQUFBLElBQ04sTUFBTztBQUFBLElBQ1AsTUFBTztBQUFBLElBQ1AsT0FBTyxFQUFFLFlBQVksS0FBSztBQUFBLElBQzFCLE9BQU87QUFBQSxNQUNMLFFBQVUsRUFBRSxRQUFRLG9CQUFvQixjQUFjLEtBQUs7QUFBQSxNQUMzRCxVQUFVLEVBQUUsUUFBUSxrQkFBb0IsSUFBSSxLQUFLO0FBQUEsSUFDbkQ7QUFBQTtBQUFBLElBRUEsUUFBUTtBQUFBLE1BQ04sYUFBYTtBQUFBLFFBQ1g7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
