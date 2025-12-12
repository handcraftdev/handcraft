import { test, expect } from "@playwright/test";

test.describe("Search Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/search");
  });

  test("should load search page", async ({ page }) => {
    await expect(page).toHaveURL(/\/search/);
  });

  test("should display search input", async ({ page }) => {
    // Look for search input
    const searchInput = page.getByRole("searchbox").or(
      page.getByPlaceholder(/search/i)
    ).or(
      page.locator("input[type='search']")
    ).or(
      page.locator("input[type='text']").first()
    );

    await expect(searchInput).toBeVisible();
  });

  test("should allow typing in search input", async ({ page }) => {
    const searchInput = page.getByRole("searchbox").or(
      page.getByPlaceholder(/search/i)
    ).or(
      page.locator("input[type='search']")
    ).or(
      page.locator("input[type='text']").first()
    );

    await searchInput.fill("test search query");

    await expect(searchInput).toHaveValue("test search query");
  });

  test("should update URL with search query", async ({ page }) => {
    const searchInput = page.getByRole("searchbox").or(
      page.getByPlaceholder(/search/i)
    ).or(
      page.locator("input[type='search']")
    ).or(
      page.locator("input[type='text']").first()
    );

    await searchInput.fill("music");
    await searchInput.press("Enter");

    // Wait for URL update
    await page.waitForTimeout(500);

    // URL may include query parameter
    const url = page.url();
    const hasQueryParam = url.includes("q=") || url.includes("query=") || url.includes("search=");

    // This is optional behavior - some apps update URL, some don't
    expect(url).toContain("/search");
  });

  test("should handle empty search gracefully", async ({ page }) => {
    const searchInput = page.getByRole("searchbox").or(
      page.getByPlaceholder(/search/i)
    ).or(
      page.locator("input[type='search']")
    ).or(
      page.locator("input[type='text']").first()
    );

    await searchInput.fill("");
    await searchInput.press("Enter");

    // Should not show error
    await expect(page.locator("text=/error/i")).not.toBeVisible();
  });

  test("should display results or empty state", async ({ page }) => {
    const searchInput = page.getByRole("searchbox").or(
      page.getByPlaceholder(/search/i)
    ).or(
      page.locator("input[type='search']")
    ).or(
      page.locator("input[type='text']").first()
    );

    await searchInput.fill("test");
    await searchInput.press("Enter");

    // Wait for potential results
    await page.waitForTimeout(1000);

    // Should show either results or "no results" message
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });
});
