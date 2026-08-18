import { defineConfig } from "vitest/config";

const apiTarget = process.env.GO_COURSE_API_URL || "http://127.0.0.1:8080";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": apiTarget,
    },
  },
  test: {
    environment: "jsdom",
    exclude: ["e2e/**", "node_modules/**"],
    globals: true,
  },
});
