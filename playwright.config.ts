import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT || 5173);
const baseURL = `http://127.0.0.1:${port}`;
// Browser fixtures seed Supabase's project-derived local-storage session key.
// Pin a non-secret test client here so the dev server resolves that same key,
// rather than the placeholder client used when an operator has no local env.
const testSupabaseUrl = 'https://gridone-test.supabase.invalid';
const testSupabaseAnonKey = 'playwright-test-anon-key';

export default defineConfig({
  testDir: './playwright-tests',
  timeout: 30_000,
  use: {
    baseURL,
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'phone-chromium',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'phone-webkit',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: `npm run ${process.env.PLAYWRIGHT_BUILT_UI === '1' ? 'preview' : 'dev'} -- --host 127.0.0.1 --port ${port} --configLoader runner`,
    env: {
      ...process.env,
      VITE_SUPABASE_URL: testSupabaseUrl,
      VITE_SUPABASE_ANON_KEY: testSupabaseAnonKey,
    },
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
