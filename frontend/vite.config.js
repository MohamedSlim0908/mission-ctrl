import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3333,
    host: true,
    proxy: {
      '/api': 'http://localhost:3334',
      '/ws': { target: 'ws://localhost:3334', ws: true }
    }
  }
})
