/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { generateStaticSeoPages } from './build/staticSeoPages';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'gridone-static-seo-pages',
      apply: 'build',
      async closeBundle() {
        await generateStaticSeoPages('dist');
      },
    },
  ],
  define: {
    'process.env': {},
  },
  server: {
    // Local dev: `wrangler pages dev --port 8788` serves the Cloudflare
    // functions; vite serves the app with HMR and forwards API calls there.
    proxy: {
      '/api': 'http://localhost:8788',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router')) return 'framework';
          if (id.includes('/@supabase/')) return 'supabase';
          if (id.includes('/gsap/') || id.includes('/lenis/')) return 'motion';
          if (id.includes('/lucide-react/')) return 'icons';
          return undefined;
        },
      },
    },
  },
  test: {
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/setup.ts'],
    },
    // Split so the two kinds of test get the scheduling each needs. The
    // integration suites each start a disposable Postgres container; running
    // their files in parallel puts ~9 containers up at once and they time out
    // waiting on Docker. Unit tests stay fully parallel.
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./tests/setup.ts'],
          include: ['tests/**/*.{test,spec}.{ts,tsx}'],
          exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./tests/setup.ts'],
          include: ['tests/**/*.integration.test.ts'],
          // One container at a time — the whole point of this split.
          fileParallelism: false,
          testTimeout: 120_000,
          hookTimeout: 300_000,
        },
      },
    ],
  },
});
