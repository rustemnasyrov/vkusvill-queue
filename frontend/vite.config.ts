import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** В Docker (особенно bind-mount с Windows) без polling часто нет событий об изменении файлов. */
const inDocker =
  process.env.DOCKER_DEV === "1" || process.env.CHOKIDAR_USEPOLLING === "true";

/** Порт на машине-хосте (см. ports в compose), иначе браузер не достучится до ws:// для HMR. */
const hmrClientPort = Number(process.env.VITE_HMR_CLIENT_PORT || 5173);

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    watch: inDocker
      ? {
          usePolling: true,
          interval: 300,
          binaryInterval: 1000,
        }
      : undefined,
    hmr: inDocker
      ? {
          host: "localhost",
          port: 5173,
          clientPort: hmrClientPort,
          protocol: "ws",
        }
      : undefined,
  },
});
