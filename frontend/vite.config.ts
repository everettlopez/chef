import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Forward API calls to FastAPI so the browser sees a single origin in dev.
    // CHEF_API_URL lets the Playwright run point at its own backend.
    proxy: {
      '/api': process.env.CHEF_API_URL ?? 'http://localhost:8000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Node's fetch needs an absolute URL; MSW intercepts this origin.
    env: { VITE_API_BASE_URL: 'http://localhost:3000/api' },
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.test.{ts,tsx}', 'src/main.tsx'],
      reporter: ['text-summary', 'text', 'html', 'lcov'],
    },
  },
})
