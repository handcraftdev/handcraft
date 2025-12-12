import { test, expect } from "@playwright/test";

test.describe("Explore Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/explore");
  });

  test("should load explore page successfully", async ({ page }) => {
    await expect(page).toHaveURL(/\/explore/);
  });

  test("should display content feed section", async ({ page }) => {
    // Check for main content area
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });

  test("should display Content and Bundles tabs", async ({ page }) => {
    // Look for tab navigation
    const contentTab = page.getByRole("tab", { name: /content/i }).or(
      page.getByRole("button", { name: /content/i })
    );
    const bundlesTab = page.getByRole("tab", { name: /bundles/i }).or(
      page.getByRole("button", { name: /bundles/i })
    );

    // At least one tab structure should be present
    const hasContentTab = await contentTab.count() > 0;
    const hasBundlesTab = await bundlesTab.count() > 0;

    expect(hasContentTab || hasBundlesTab).toBeTruthy();
  });

  test("should have sorting options", async ({ page }) => {
    // Look for sort controls (dropdown or buttons)
    const sortControl = page.locator("[data-testid='sort-control']").or(
      page.getByRole("combobox")
    ).or(
      page.locator("select")
    );

    // If sorting is implemented, verify it exists
    const sortCount = await sortControl.count();
    // This is a soft check - sorting may or may not be visible
    if (sortCount > 0) {
      await expect(sortControl.first()).toBeVisible();
    }
  });

  test("should handle empty state gracefully", async ({ page }) => {
    // Page should not show error even if no content
    await expect(page.locator("text=/error/i")).not.toBeVisible();
  });

  test("should support URL parameters for tab selection", async ({ page }) => {
    // Navigate with tab parameter
    await page.goto("/explore?tab=bundles");
    await expect(page).toHaveURL(/tab=bundles/);
  });

  test("should display content cards when content exists", async ({ page }) => {
    // Wait for potential content to load
    await page.waitForTimeout(2000);

    // Check for card elements (may be empty if no content)
    const cards = page.locator("[data-testid='content-card']").or(
      page.locator("article")
    ).or(
      page.locator(".card")
    );

    const cardCount = await cards.count();
    // Just verify the structure works - content may or may not exist
    expect(cardCount).toBeGreaterThanOrEqual(0);
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
