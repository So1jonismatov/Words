import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/**
 * E2E runs a production build against its own throwaway database (data/e2e.db),
 * so it never touches data/local.db and can run while `npm run dev` is up.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "uz-UZ",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `node -e "require('fs').rmSync('data/e2e.db',{force:true})" && npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: "file:./data/e2e.db",
      ADMIN_PASSWORD: "e2e-admin-password",
      SESSION_SECRET: "e2e-session-secret-0123456789abcdef",
    },
  },
});
