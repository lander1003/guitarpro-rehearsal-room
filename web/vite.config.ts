import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { alphaTab } from "@coderline/alphatab-vite";

export default defineConfig({
  plugins: [react(), alphaTab()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:3010",
      "/songs": "http://localhost:3010"
    }
  }
});
