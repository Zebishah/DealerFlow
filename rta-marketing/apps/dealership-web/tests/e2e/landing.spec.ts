import { expect, test } from "@playwright/test";

// Keep the public presentation independent of inventory/auth service availability.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/**", route => {
    if (new URL(route.request().url()).pathname.endsWith("/auth/session")) {
      return route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED", message: "Sign in required" } } });
    }
    return route.fulfill({ json: { data: { items: [], sources: [] }, page: { limit: 4, offset: 0, total: 0, hasMore: false } } });
  });
});

test("visitors can explore different product workflows with pointer and keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByRole("heading", { name: "Sales pipeline" })).toBeVisible();
  const vehicles = page.getByRole("tab", { name: "Vehicle intelligence", exact: true });
  await vehicles.click();
  await expect(vehicles).toHaveAttribute("aria-selected", "true");
  await expect(panel.getByText("Romans International", { exact: true })).toBeVisible();
  await vehicles.press("Home");
  await expect(page.getByRole("tab", { name: "Sales pipeline" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(panel.getByText("Meet the customer", { exact: true })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(panel.getByText("Commissions", { exact: true })).toBeVisible();
});

test("phone visitors can navigate, read the page, and expand the complete feature list", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open menu" });
  await menu.click();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await menu.click();
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "The platform" }).click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveURL(/#solutions$/);
  await page.locator("#workspace summary").filter({ hasText: "People, access & records" }).click();
  await expect(page.getByText("Audit history", { exact: true })).toBeVisible();
  await expect(page.getByText("Access request review", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator(".studio-hero-copy > p").evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  expect(await page.locator(".studio-hero-visual > img").evaluate(el => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0)).toBe(true);
});

test("intelligence questions open the existing assistant with the chosen question", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Which leads need attention?", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Ask the Dealer Flow assistant" })).toHaveValue("Which leads need attention?");
  await page.getByRole("button", { name: "Close assistant", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Ask the Dealer Flow assistant" })).not.toBeVisible();
});

test("inventory failure provides a working retry without blocking the product page", async ({ page }) => {
  await page.route("**/scraping-results/public?*", route => route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE", message: "Inventory unavailable" } } }));
  await page.goto("/");
  await expect(page.getByRole("alert").filter({ hasText: "Live listings are unavailable" })).toBeVisible();
  await page.route("**/scraping-results/public?*", route => route.fulfill({ json: { data: { items: [], sources: [] }, page: { limit: 4, offset: 0, total: 0, hasMore: false } } }));
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByText("The collection is waiting for its next arrivals.", { exact: true })).toBeVisible();
});
