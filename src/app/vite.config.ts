import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  root: "src/ui",
  plugins: [
    TanStackRouterVite({ routesDirectory: "routes", generatedRouteTree: "routeTree.gen.ts" }),
    react(),
    tailwindcss(),
  ],
  build: {
    outDir: "../../src/db_residential_copilot/__dist__",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
