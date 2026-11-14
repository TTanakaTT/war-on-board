import { defineConfig, devices } from "@playwright/test";

// AI-vs-AI invariant simulation (see .github/workflows/invariant-simulation.yml).
// Runs against the dev server because the debug mode only exists in dev builds.
const DEV_SERVER_PORT = 5173;

export default defineConfig({
  testDir: "tests/simulation",
  webServer: {
    command: `pnpm run dev --port ${DEV_SERVER_PORT} --strictPort`,
    port: DEV_SERVER_PORT,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${DEV_SERVER_PORT}`,
  },
  workers: 1,
  reporter: "list",
  outputDir: "test-results/simulation/",
});
