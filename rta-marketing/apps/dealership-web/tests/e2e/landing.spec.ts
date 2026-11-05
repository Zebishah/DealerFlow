import { expect, test } from "@playwright/test";

// Keep presentation tests independent of the availability of live inventory/auth services.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/**", route => {
    if (new URL(route.request().url()).pathname.endsWith("/auth/session")) {
      return route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED", message: "Sign in required" } } });
    }
    return route.fulfill({ json: { data: { items: [], sources: [] }, page: { limit: 8, offset: 0, total: 0, hasMore: false } } });
  });
});

test("landing workspace tabs update the preview and support keyboard navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByRole("heading", { name: "Sales pipeline" })).toBeVisible();
  const vehicles = page.getByRole("tab", { name: "Vehicle intelligence", exact: true });
  await vehicles.click();
  await expect(vehicles).toHaveAttribute("aria-selected", "true");
  await expect(panel).toHaveAttribute("aria-labelledby", "workspace-tab-vehicles");
  await expect(panel.getByText("Romans International", { exact: true })).toBeVisible();
  await vehicles.press("ArrowDown");
  const performance = page.getByRole("tab", { name: "Team performance" });
  await expect(performance).toBeFocused();
  await expect(panel.getByRole("heading", { name: "Team performance" })).toBeVisible();
  await performance.press("Home");
  await expect(page.getByRole("tab", { name: "Sales pipeline" })).toBeFocused();
  await expect(panel.getByRole("heading", { name: "Sales pipeline" })).toBeVisible();
});

test("mobile navigation closes with Escape and after selecting a section", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open menu" });
  await menu.click();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await menu.click();
  await page.getByRole("navigation").getByRole("link", { name: "The platform" }).click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveURL(/#solutions$/);
  await expect(page.getByRole("tablist")).toHaveAttribute("aria-orientation", "horizontal");
  await page.getByRole("tab", { name: "Sales pipeline" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Vehicle intelligence", exact: true })).toBeFocused();
});

test("landing intelligence questions open the existing assistant with the selected prompt", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Which leads need attention?", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Ask the RTA assistant" })).toHaveValue("Which leads need attention?");
  await page.getByRole("button", { name: "Close assistant", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Ask the RTA assistant" })).not.toBeVisible();
});

test("the vehicle scene resets pointer motion when reduced motion is enabled", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const stage = page.locator(".rta-vehicle-stage");
  await stage.hover({ position: { x: 60, y: 60 } });
  await expect.poll(() => stage.evaluate(el => el.style.getPropertyValue("--stage-x"))).not.toBe("");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => stage.evaluate(el => el.style.getPropertyValue("--stage-x"))).toBe("");
  await expect(page.locator(".rta-stage-dimension")).toHaveCSS("transform", "none");
  await expect(page.locator(".rta-stage-car")).toHaveCSS("animation-name", "none");
  await stage.hover({ position: { x: 120, y: 90 } });
  await expect.poll(() => stage.evaluate(el => el.style.getPropertyValue("--stage-x"))).toBe("");
});
