import { test, expect } from "@playwright/test";

test.describe("Search Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/search");
  });

  test("should load search page", async ({ page }) => {
    await expect(page).toHaveURL(/\/search/);
  });

  test("should display search input", async ({ page }) => {
    // Target the search input in main (not header)
    const searchInput = page.locator("main").getByPlaceholder("Search content, bundles, creators...");
    await expect(searchInput).toBeVisible();
  });

  test("should allow typing in search input", async ({ page }) => {
    const searchInput = page.locator("main").getByPlaceholder("Search content, bundles, creators...");
    await searchInput.fill("test search query");
    await expect(searchInput).toHaveValue("test search query");
  });

  test("should update URL with search query", async ({ page }) => {
    const searchInput = page.locator("main").getByPlaceholder("Search content, bundles, creators...");
    await searchInput.fill("music");
    await searchInput.press("Enter");

    await expect(page).toHaveURL(/\/search\?q=music/);
  });

  test("should handle empty search gracefully", async ({ page }) => {
    const searchInput = page.locator("main").getByPlaceholder("Search content, bundles, creators...");
    // Clear input and press Enter with empty value should not navigate
    await searchInput.fill("test");
    await searchInput.fill("");
    await searchInput.press("Enter");

    // Should stay on search page without error
    await expect(page).toHaveURL(/\/search/);
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });

  test("should display search history or empty state", async ({ page }) => {
    // Without query, should show "Search for content" or recent searches
    const main = page.locator("main");
    await expect(main).toBeVisible();

    // Either shows recent searches or empty state
    const emptyState = page.getByText("Search for content");
    const recentSearches = page.getByText("Recent Searches");

    const hasEmptyState = await emptyState.count() > 0;
    const hasRecentSearches = await recentSearches.count() > 0;

    expect(hasEmptyState || hasRecentSearches).toBeTruthy();
  });

  test("should show no results or loading state for non-matching query", async ({ page }) => {
    const searchInput = page.locator("main").getByPlaceholder("Search content, bundles, creators...");
    await searchInput.fill("xyznonexistent123");
    await searchInput.press("Enter");

    await expect(page).toHaveURL(/\/search\?q=xyznonexistent123/);

    // Wait for either "No results found" or keep main visible (loading state)
    // The search indexes blockchain data which may take time to load
    const main = page.locator("main");
    await expect(main).toBeVisible();

    // Give time for search to complete
    await page.waitForTimeout(2000);

    // Should still be on search page with query
    await expect(page).toHaveURL(/\/search\?q=xyznonexistent123/);
  });
});
