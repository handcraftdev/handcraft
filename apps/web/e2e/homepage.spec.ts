import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should load homepage successfully", async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Handcraft/i);
  });

  test("should display header with navigation", async ({ page }) => {
    // Check header exists
    const header = page.locator("header");
    await expect(header).toBeVisible();

    // Check logo/brand is present
    const logo = page.getByRole("link", { name: /handcraft/i }).first();
    await expect(logo).toBeVisible();
  });

  test("should display hero section", async ({ page }) => {
    // Check for main heading or hero content
    const mainContent = page.locator("main");
    await expect(mainContent).toBeVisible();
  });

  test("should have explore link in navigation", async ({ page }) => {
    // Find and verify explore link
    const exploreLink = page.getByRole("link", { name: /explore/i }).first();
    await expect(exploreLink).toBeVisible();
  });

  test("should navigate to explore page", async ({ page }) => {
    // Click explore link
    const exploreLink = page.getByRole("link", { name: /explore/i }).first();
    await exploreLink.click();

    // Verify navigation
    await expect(page).toHaveURL(/\/explore/);
  });

  test("should display connect wallet button", async ({ page }) => {
    // Look for wallet connection button
    const walletButton = page.getByRole("button", { name: /connect|wallet/i }).first();
    await expect(walletButton).toBeVisible();
  });

  test("should be responsive on mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Page should still load and display content
    const mainContent = page.locator("main");
    await expect(mainContent).toBeVisible();
  });
});
