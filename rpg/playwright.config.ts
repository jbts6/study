import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5174",
    viewport: { width: 1440, height: 900 },
  },
  webServer: [
    {
      command: "npm run runner -- --port 5175",
      port: 5175,
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5174",
      port: 5174,
      reuseExistingServer: false,
    },
  ],
});
