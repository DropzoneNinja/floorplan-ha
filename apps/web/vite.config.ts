import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "HomePlan HA",
        short_name: "HomePlan",
        description: "Home automation floorplan dashboard",
        theme_color: "#1a1a1a",
        background_color: "#1a1a1a",
        display: "standalone",
        orientation: "landscape",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        runtimeCaching: [],     // no caching — live data only
        navigateFallback: null, // let nginx handle SPA routing
        globPatterns: [],       // no asset precaching
      },
    }),
  ],
  resolve: {
    alias: {
      "@floorplan-ha/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    watch: { usePolling: true },
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
