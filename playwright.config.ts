import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the real application, backend and Keycloak.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // Data baseline guaranteed before any test: a client and a lawyer (see the file).
  globalSetup: "./tests/e2e/preparation.ts",
  /**
   * The 30 s default is not enough: authentication goes through a real Keycloak and a test chains
   * several routes. This compensates for the test harness, not for application slowness
   * (performance targets are measured on a production build, NF-PERF-01).
   */
  timeout: 180_000,
  /**
   * Assertion timeout raised from 5 s to 20 s: each assertion may wait for a round trip to a real
   * Keycloak and backend, with several parallel workers on the same instance.
   */
  expect: { timeout: 20_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    locale: "fr-FR",
  },
  /**
   * Uses the locally installed Chrome rather than Playwright's downloaded Chromium:
   * `cdn.playwright.dev` is unreachable from the bank's workstations, so `npx playwright install`
   * fails. Removing `channel` restores the pinned browser once the CDN is reachable.
   */
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
  webServer: {
    /**
     * Production build, not the dev server: on-demand route compilation with parallel workers caused
     * intermittent failures. A production build makes the suite deterministic and closer to what is
     * shipped, at the cost of a build up front.
     */
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    // Cold build: after `rm -rf .next`, Next rebuilds everything before answering.
    timeout: 300_000,
  },
});
