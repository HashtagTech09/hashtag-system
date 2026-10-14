import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: 'crm-ui.spec.ts', workers: 1,
  use: { baseURL: 'http://127.0.0.1:5186', browserName: 'chromium', channel: 'chrome', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5186 --strictPort',
    url: 'http://127.0.0.1:5186', reuseExistingServer: !process.env.CI,
    env: { VITE_CRM_LEADS_ENABLED: 'true', VITE_SUPABASE_URL: 'https://crm-local.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'synthetic-public-key-not-for-production' },
  },
});
