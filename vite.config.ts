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
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/setup.ts'],
    },
  },
});
