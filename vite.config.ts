import { defineConfig } from "vite"

export default defineConfig({
  base: "./",
  build: {
    manifest: true,
    rollupOptions: { input: ["index.html", "picker.html"] },
  },
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
})
