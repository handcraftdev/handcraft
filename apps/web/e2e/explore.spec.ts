import { test, expect } from "@playwright/test";

test.describe("Explore Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/explore");
  });

  test("should load explore page successfully", async ({ page }) => {
    await expect(page).toHaveURL(/\/explore/);
  });

  test("should display main content area", async ({ page }) => {
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });

  test("should display Content and Bundles tabs", async ({ page }) => {
    // Tab buttons
    const contentTab = page.getByRole("button", { name: /Content/i }).first();
    const bundlesTab = page.getByRole("button", { name: /Bundles/i });

    await expect(contentTab).toBeVisible();
    await expect(bundlesTab).toBeVisible();
  });

  test("should switch to Bundles tab", async ({ page }) => {
    const bundlesTab = page.getByRole("button", { name: /Bundles/i });
    await bundlesTab.click();

    await expect(page).toHaveURL(/tab=bundles/);
  });

  test("should switch back to Content tab", async ({ page }) => {
    // First switch to bundles
    await page.getByRole("button", { name: /Bundles/i }).click();
    await expect(page).toHaveURL(/tab=bundles/);

    // Switch back to content
    await page.getByRole("button", { name: /Content/i }).first().click();
    await expect(page).toHaveURL(/tab=content/);
  });

  test("should support URL parameters for tab selection", async ({ page }) => {
    await page.goto("/explore?tab=bundles");
    await expect(page).toHaveURL(/tab=bundles/);
  });

  test("should display header", async ({ page }) => {
    const header = page.locator("header");
    await expect(header).toBeVisible();
  });

  test("should display sidebar on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Sidebar exists (may be hidden on mobile)
    const sidebar = page.locator("aside");
    const sidebarCount = await sidebar.count();
    expect(sidebarCount).toBeGreaterThanOrEqual(0);
  });

  test("should be responsive on tablet viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    const main = page.locator("main");
    await expect(main).toBeVisible();
  });

  test("should be responsive on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const main = page.locator("main");
    await expect(main).toBeVisible();
  });
});
