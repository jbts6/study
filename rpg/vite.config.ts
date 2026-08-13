import { defineConfig } from "vitest/config";

export default defineConfig({
  server: { host: "127.0.0.1", port: 5174 },
  test: { environment: "jsdom", include: ["src/**/*.test.ts"], globals: true },
});
