import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/scent-smoke-carousel/" : "/",
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2020",
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
