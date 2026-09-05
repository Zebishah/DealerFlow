import { defineConfig } from "@playwright/test";

const systemFirefox = process.env.USE_SYSTEM_FIREFOX === "true" ? "/usr/bin/firefox" : undefined;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "firefox",
    headless: true,
    launchOptions: systemFirefox ? { executablePath: systemFirefox } : undefined,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
