import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "src/dashboard",
  base: "/assets/",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:7878",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "../../dist/assets",
    assetsDir: ".",
    emptyOutDir: true,
  },
});
