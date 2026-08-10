import { defineConfig } from "vite"

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
    proxy: {
      "/__github_releases": {
        target: "https://github.com",
        changeOrigin: true,
        rewrite: () => "/rekazer0/BdiEditor/releases",
      },
    },
  },
})
