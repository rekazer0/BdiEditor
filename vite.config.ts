import { defineConfig } from "vite"

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: { input: ["index.html", "picker.html"] },
  },
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
})
