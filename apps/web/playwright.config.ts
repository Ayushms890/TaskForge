import { defineConfig, devices } from "@playwright/test";
import { localURL } from "./e2e/urls";

export default defineConfig({
  testDir: "./e2e",
  // Keep browser tests out of the existing Vitest *.test/*.spec discovery.
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  outputDir: "./e2e/test-results",
  use: {
    baseURL: localURL(process.env.E2E_BASE_URL ?? "http://localhost:3100"),
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Use full Chromium's headless mode. The separate headless-shell binary
        // fails to spawn on this Windows installation; full Chromium is verified.
        channel: "chromium",
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
  // Intentionally no webServer: the caller starts a dedicated, isolated stack.
});
