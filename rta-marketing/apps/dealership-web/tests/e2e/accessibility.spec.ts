import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicInventoryPayload = {
  data: {
    items: [{
      id: 1,
      siteId: 1,
      siteName: "Romans International",
      title: "2024 Ferrari Roma",
      price: "£189,000",
      year: "2024",
      mileage: "3,200 miles",
      city: "London",
      listingUrl: "https://example.com/cars/1",
      thumbnailUrl: null,
      scrapedAt: "2026-09-17T12:00:00.000Z",
    }],
    sources: [{ id: 1, name: "Romans International", siteKey: "romans-international" }],
  },
  page: { limit: 24, offset: 0, total: 1, hasMore: false },
};

test("public inventory supports searching and keeps serious accessibility violations at zero", async ({ page }) => {
  await page.route("**scraping-results/public**", async (route) => {
    await route.fulfill({ json: publicInventoryPayload });
  });

  await page.goto("/inventory");
  await expect(page.getByRole("heading", { name: "Search live listings" })).toBeVisible();
  await expect(page.getByText("2024 Ferrari Roma")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search make, model, keyword or location" }).fill("Ferrari");
  await expect(page.getByRole("link", { name: "Sign in to compare 2024 Ferrari Roma" })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);
});

test("login page has no serious accessibility violations", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in to your workspace" })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);
});
