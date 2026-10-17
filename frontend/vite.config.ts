import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In development the API runs in Docker on :8080; proxying keeps requests same-origin.
    proxy: { '/api': 'http://localhost:8080' },
  },
})
