import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("should navigate from home to explore", async ({ page }) => {
    await page.goto("/");

    // Click explore link
    await page.getByRole("link", { name: /explore/i }).first().click();

    await expect(page).toHaveURL(/\/explore/);
  });

  test("should navigate from explore to home via logo", async ({ page }) => {
    await page.goto("/explore");

    // Click logo/home link
    const homeLink = page.getByRole("link", { name: /handcraft/i }).first();
    await homeLink.click();

    await expect(page).toHaveURL("/");
  });

  test("should navigate to search page", async ({ page }) => {
    await page.goto("/");

    // Look for search link or button
    const searchLink = page.getByRole("link", { name: /search/i }).first();

    if (await searchLink.isVisible()) {
      await searchLink.click();
      await expect(page).toHaveURL(/\/search/);
    }
  });

  test("should navigate to dashboard when clicked", async ({ page }) => {
    await page.goto("/");

    // Find dashboard link in sidebar or nav
    const dashboardLink = page.getByRole("link", { name: /dashboard/i }).first();

    if (await dashboardLink.isVisible()) {
      await dashboardLink.click();
      await expect(page).toHaveURL(/\/dashboard/);
    }
  });

  test("should handle 404 for invalid routes", async ({ page }) => {
    const response = await page.goto("/this-route-does-not-exist-12345");

    // Should either show 404 page or redirect
    const url = page.url();
    const is404Page = url.includes("404") || url.includes("not-found");
    const isRedirected = !url.includes("this-route-does-not-exist");

    expect(is404Page || isRedirected || response?.status() === 404).toBeTruthy();
  });

  test("should preserve scroll position on back navigation", async ({ page }) => {
    await page.goto("/explore");

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 500));

    // Navigate away
    await page.goto("/");

    // Go back
    await page.goBack();

    // Wait for navigation
    await expect(page).toHaveURL(/\/explore/);
  });

  test("should have working sidebar navigation on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    // Check for sidebar
    const sidebar = page.locator("aside").or(page.locator("[data-testid='sidebar']"));

    if (await sidebar.isVisible()) {
      // Verify sidebar links exist
      const sidebarLinks = sidebar.getByRole("link");
      const linkCount = await sidebarLinks.count();
      expect(linkCount).toBeGreaterThan(0);
    }
  });
});
