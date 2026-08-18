import { defineConfig } from "@playwright/test";

const webPort = process.env.GO_COURSE_WEB_PORT ?? "5173";
const baseURL = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: "line",
  use: {
    baseURL,
    headless: true,
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${webPort}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
