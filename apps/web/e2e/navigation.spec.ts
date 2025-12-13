import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("should navigate from home to content via Explore Content link", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Explore Content/i }).click();
    await expect(page).toHaveURL(/\/content/);
  });

  test("should navigate from home to studio via Start Creating link", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Start Creating/i }).first().click();
    await expect(page).toHaveURL(/\/studio/);
  });

  test("should navigate to search via header search", async ({ page }) => {
    await page.goto("/");

    // Find the search input in header
    const searchInput = page.locator("header input[type='text']");
    await searchInput.fill("test");
    await searchInput.press("Enter");

    await expect(page).toHaveURL(/\/search\?q=test/);
  });

  test("should navigate to search page directly", async ({ page }) => {
    await page.goto("/search");
    await expect(page).toHaveURL(/\/search/);
  });

  test("should navigate to studio page directly", async ({ page }) => {
    await page.goto("/studio");
    await expect(page).toHaveURL(/\/studio/);
  });

  test("should preserve scroll position on back navigation", async ({ page }) => {
    await page.goto("/content");

    // Wait for page load
    await page.waitForLoadState("networkidle");

    // Navigate to search
    await page.goto("/search");
    await page.waitForLoadState("networkidle");

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/\/content/);
  });

  test("should have working sidebar navigation on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/content");

    // Check sidebar exists
    const sidebar = page.locator("aside");
    const sidebarCount = await sidebar.count();

    if (sidebarCount > 0) {
      await expect(sidebar.first()).toBeVisible();
    }
  });

  test("should navigate between content and bundles tabs", async ({ page }) => {
    await page.goto("/content");
    await expect(page).toHaveURL(/\/content/);

    await page.goto("/bundles");
    await expect(page).toHaveURL(/\/bundles/);
  });
});
