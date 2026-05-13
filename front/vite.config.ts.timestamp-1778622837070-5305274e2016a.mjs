// vite.config.ts
import { defineConfig } from "file:///app/node_modules/vite/dist/node/index.js";
import react from "file:///app/node_modules/@vitejs/plugin-react/dist/index.js";
var virtualCssPath = "/@virtual:ssr-css.css";
function pluginSsrDevFoucFix() {
  const collectedStyles = /* @__PURE__ */ new Map();
  let server;
  return {
    name: "ssr-dev-FOUC-fix",
    apply: "serve",
    transform(code, id) {
      if (id.includes("node_modules")) return null;
      if (id.includes(".css")) collectedStyles.set(id, code);
      return null;
    },
    configureServer(server_) {
      server = server_;
      server.middlewares.use((req, res, next) => {
        if (req.url === virtualCssPath) {
          res.setHeader("Content-Type", "text/css");
          res.write(Array.from(collectedStyles.values()).join("\n"));
          res.end();
          return;
        }
        next();
      });
    },
    transformIndexHtml: {
      handler: async () => [
        { tag: "link", injectTo: "head", attrs: { rel: "stylesheet", href: virtualCssPath } }
      ]
    }
  };
}
var vite_config_default = defineConfig({
  plugins: [react(), pluginSsrDevFoucFix()],
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
      "react-router-dom",
      "zustand",
      "@stomp/stompjs"
    ]
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    watch: { usePolling: true, interval: 800 },
    proxy: {
      "/api": { target: "http://back:3001", changeOrigin: true },
      "/stomp": { target: "ws://back:3001", ws: true }
    },
    warmup: {
      clientFiles: [
        "./src/main.tsx",
        "./src/App.tsx",
        "./src/components/graph/GraphPage.tsx",
        "./src/lib/BibleMap/BibleMap.tsx",
        "./src/lib/BibleMap/scene.ts",
        "./src/components/bible/BibleDrawer.tsx",
        "./src/store/relations.store.ts",
        "./src/store/bibleContent.store.ts",
        "./src/hooks/useVerseRelations.ts",
        "./src/hooks/useStompPlaces.ts",
        "./src/hooks/useStompMapFeatures.ts"
      ]
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvYXBwL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgdHlwZSB7IFBsdWdpbiwgVml0ZURldlNlcnZlciB9IGZyb20gJ3ZpdGUnO1xuXG5jb25zdCB2aXJ0dWFsQ3NzUGF0aCA9ICcvQHZpcnR1YWw6c3NyLWNzcy5jc3MnO1xuXG5mdW5jdGlvbiBwbHVnaW5Tc3JEZXZGb3VjRml4KCk6IFBsdWdpbiB7XG4gIGNvbnN0IGNvbGxlY3RlZFN0eWxlcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gIGxldCBzZXJ2ZXI6IFZpdGVEZXZTZXJ2ZXI7XG5cbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnc3NyLWRldi1GT1VDLWZpeCcsXG4gICAgYXBwbHk6ICdzZXJ2ZScsXG4gICAgdHJhbnNmb3JtKGNvZGU6IHN0cmluZywgaWQ6IHN0cmluZykge1xuICAgICAgaWYgKGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMnKSkgcmV0dXJuIG51bGw7XG4gICAgICBpZiAoaWQuaW5jbHVkZXMoJy5jc3MnKSkgY29sbGVjdGVkU3R5bGVzLnNldChpZCwgY29kZSk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXJfKSB7XG4gICAgICBzZXJ2ZXIgPSBzZXJ2ZXJfO1xuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgocmVxLCByZXMsIG5leHQpID0+IHtcbiAgICAgICAgaWYgKChyZXEgYXMgYW55KS51cmwgPT09IHZpcnR1YWxDc3NQYXRoKSB7XG4gICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ3RleHQvY3NzJyk7XG4gICAgICAgICAgcmVzLndyaXRlKEFycmF5LmZyb20oY29sbGVjdGVkU3R5bGVzLnZhbHVlcygpKS5qb2luKCdcXG4nKSk7XG4gICAgICAgICAgcmVzLmVuZCgpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBuZXh0KCk7XG4gICAgICB9KTtcbiAgICB9LFxuICAgIHRyYW5zZm9ybUluZGV4SHRtbDoge1xuICAgICAgaGFuZGxlcjogYXN5bmMgKCkgPT4gW1xuICAgICAgICB7IHRhZzogJ2xpbmsnLCBpbmplY3RUbzogJ2hlYWQnLCBhdHRyczogeyByZWw6ICdzdHlsZXNoZWV0JywgaHJlZjogdmlydHVhbENzc1BhdGggfSB9LFxuICAgICAgXSxcbiAgICB9LFxuICB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKSwgcGx1Z2luU3NyRGV2Rm91Y0ZpeCgpXSxcbiAgcmVzb2x2ZTogeyBhbGlhczogeyAnQCc6ICcvc3JjJyB9IH0sXG4gIC8vIEtlZXAgVml0ZSdzIGVzYnVpbGQgZGVwIGNhY2hlIGluc2lkZSBub2RlX21vZHVsZXMgKG5hbWVkIERvY2tlciB2b2x1bWUpIHNvIGl0IHN1cnZpdmVzIHJlc3RhcnRzXG4gIGNhY2hlRGlyOiAnbm9kZV9tb2R1bGVzLy52aXRlJyxcblxuICAvLyBQclx1MDBFOS1idW5kbGUgbGVzIGxpYnMgbG91cmRlcyBhdSBkXHUwMEU5bWFycmFnZSBkdSBzZXJ2ZXVyIGRldlxuICAvLyBcdTIxOTIgXHUwMEU5dml0ZSBsYSB0cmFuc2Zvcm1hdGlvbiBcdTAwRTAgbGEgZGVtYW5kZSBzdXIgbGUgcHJlbWllciBjaGFyZ2VtZW50XG4gIG9wdGltaXplRGVwczoge1xuICAgIGluY2x1ZGU6IFtcbiAgICAgICd0aHJlZScsXG4gICAgICAndGhyZWUvYWRkb25zL2NvbnRyb2xzL09yYml0Q29udHJvbHMuanMnLFxuICAgICAgJ0ByZWFjdC10aHJlZS9maWJlcicsXG4gICAgICAnQHJlYWN0LXRocmVlL2RyZWknLFxuICAgICAgJ3JlYWN0JyxcbiAgICAgICdyZWFjdC1kb20nLFxuICAgICAgJ3JlYWN0LXJvdXRlci1kb20nLFxuICAgICAgJ3p1c3RhbmQnLFxuICAgICAgJ0BzdG9tcC9zdG9tcGpzJyxcbiAgICBdLFxuICB9LFxuXG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6ICAnMC4wLjAuMCcsXG4gICAgcG9ydDogIDUxNzMsXG4gICAgd2F0Y2g6IHsgdXNlUG9sbGluZzogdHJ1ZSwgaW50ZXJ2YWw6IDgwMCB9LFxuICAgIHByb3h5OiB7XG4gICAgICAnL2FwaSc6ICAgeyB0YXJnZXQ6ICdodHRwOi8vYmFjazozMDAxJywgY2hhbmdlT3JpZ2luOiB0cnVlIH0sXG4gICAgICAnL3N0b21wJzogeyB0YXJnZXQ6ICd3czovL2JhY2s6MzAwMScsICAgd3M6IHRydWUgfSxcbiAgICB9LFxuICAgIHdhcm11cDoge1xuICAgICAgY2xpZW50RmlsZXM6IFtcbiAgICAgICAgJy4vc3JjL21haW4udHN4JyxcbiAgICAgICAgJy4vc3JjL0FwcC50c3gnLFxuICAgICAgICAnLi9zcmMvY29tcG9uZW50cy9ncmFwaC9HcmFwaFBhZ2UudHN4JyxcbiAgICAgICAgJy4vc3JjL2xpYi9CaWJsZU1hcC9CaWJsZU1hcC50c3gnLFxuICAgICAgICAnLi9zcmMvbGliL0JpYmxlTWFwL3NjZW5lLnRzJyxcbiAgICAgICAgJy4vc3JjL2NvbXBvbmVudHMvYmlibGUvQmlibGVEcmF3ZXIudHN4JyxcbiAgICAgICAgJy4vc3JjL3N0b3JlL3JlbGF0aW9ucy5zdG9yZS50cycsXG4gICAgICAgICcuL3NyYy9zdG9yZS9iaWJsZUNvbnRlbnQuc3RvcmUudHMnLFxuICAgICAgICAnLi9zcmMvaG9va3MvdXNlVmVyc2VSZWxhdGlvbnMudHMnLFxuICAgICAgICAnLi9zcmMvaG9va3MvdXNlU3RvbXBQbGFjZXMudHMnLFxuICAgICAgICAnLi9zcmMvaG9va3MvdXNlU3RvbXBNYXBGZWF0dXJlcy50cycsXG4gICAgICBdLFxuICAgIH0sXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBOEwsU0FBUyxvQkFBb0I7QUFDM04sT0FBTyxXQUFXO0FBR2xCLElBQU0saUJBQWlCO0FBRXZCLFNBQVMsc0JBQThCO0FBQ3JDLFFBQU0sa0JBQWtCLG9CQUFJLElBQW9CO0FBQ2hELE1BQUk7QUFFSixTQUFPO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsSUFDUCxVQUFVLE1BQWMsSUFBWTtBQUNsQyxVQUFJLEdBQUcsU0FBUyxjQUFjLEVBQUcsUUFBTztBQUN4QyxVQUFJLEdBQUcsU0FBUyxNQUFNLEVBQUcsaUJBQWdCLElBQUksSUFBSSxJQUFJO0FBQ3JELGFBQU87QUFBQSxJQUNUO0FBQUEsSUFDQSxnQkFBZ0IsU0FBUztBQUN2QixlQUFTO0FBQ1QsYUFBTyxZQUFZLElBQUksQ0FBQyxLQUFLLEtBQUssU0FBUztBQUN6QyxZQUFLLElBQVksUUFBUSxnQkFBZ0I7QUFDdkMsY0FBSSxVQUFVLGdCQUFnQixVQUFVO0FBQ3hDLGNBQUksTUFBTSxNQUFNLEtBQUssZ0JBQWdCLE9BQU8sQ0FBQyxFQUFFLEtBQUssSUFBSSxDQUFDO0FBQ3pELGNBQUksSUFBSTtBQUNSO0FBQUEsUUFDRjtBQUNBLGFBQUs7QUFBQSxNQUNQLENBQUM7QUFBQSxJQUNIO0FBQUEsSUFDQSxvQkFBb0I7QUFBQSxNQUNsQixTQUFTLFlBQVk7QUFBQSxRQUNuQixFQUFFLEtBQUssUUFBUSxVQUFVLFFBQVEsT0FBTyxFQUFFLEtBQUssY0FBYyxNQUFNLGVBQWUsRUFBRTtBQUFBLE1BQ3RGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRjtBQUVBLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLEdBQUcsb0JBQW9CLENBQUM7QUFBQSxFQUN4QyxTQUFTLEVBQUUsT0FBTyxFQUFFLEtBQUssT0FBTyxFQUFFO0FBQUE7QUFBQSxFQUVsQyxVQUFVO0FBQUE7QUFBQTtBQUFBLEVBSVYsY0FBYztBQUFBLElBQ1osU0FBUztBQUFBLE1BQ1A7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFFQSxRQUFRO0FBQUEsSUFDTixNQUFPO0FBQUEsSUFDUCxNQUFPO0FBQUEsSUFDUCxPQUFPLEVBQUUsWUFBWSxNQUFNLFVBQVUsSUFBSTtBQUFBLElBQ3pDLE9BQU87QUFBQSxNQUNMLFFBQVUsRUFBRSxRQUFRLG9CQUFvQixjQUFjLEtBQUs7QUFBQSxNQUMzRCxVQUFVLEVBQUUsUUFBUSxrQkFBb0IsSUFBSSxLQUFLO0FBQUEsSUFDbkQ7QUFBQSxJQUNBLFFBQVE7QUFBQSxNQUNOLGFBQWE7QUFBQSxRQUNYO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
