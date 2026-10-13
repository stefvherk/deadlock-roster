import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves a project site from /<repo>/ — the deploy workflow sets BASE_PATH to that.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          gsap: ['gsap', '@gsap/react', 'lenis'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
