/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: env.VITE_DATA_API_URL,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/dev': {
          target: env.VITE_SEARCH_API_URL,
          changeOrigin: true,
          secure: true,
        },
        '/geocoder': {
          target: 'https://geocoding.geo.census.gov',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/geocoder/, '/geocoder'),
        },
        '/monitoring': {
          target: env.VITE_MONITORING_API_URL,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/monitoring/, ''),
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      exclude: ['e2e/**', 'node_modules/**'],
    },
  }
})
