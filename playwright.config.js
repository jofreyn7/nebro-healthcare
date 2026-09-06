// @ts-check
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 15000,
  retries: 1,
  use: {
    baseURL: "http://localhost:8080",
    headless: true,
  },
});
