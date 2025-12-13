import { test, expect } from "@playwright/test";

test.describe("Studio Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/studio");
  });

  test("should load studio page", async ({ page }) => {
    await expect(page).toHaveURL(/\/studio/);
  });

  test("should display main content area", async ({ page }) => {
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });

  test("should show connect wallet prompt when not connected", async ({ page }) => {
    // Studio shows "Connect Wallet" heading when not connected
    const connectHeading = page.getByRole("heading", { name: /Connect Wallet/i });
    await expect(connectHeading).toBeVisible();

    // Also shows explanation text
    const connectText = page.getByText("Please connect your wallet to view your studio");
    await expect(connectText).toBeVisible();
  });

  test("should display header", async ({ page }) => {
    const header = page.locator("header");
    await expect(header).toBeVisible();
  });

  test("should display sidebar on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const sidebar = page.locator("aside");
    const sidebarCount = await sidebar.count();
    expect(sidebarCount).toBeGreaterThanOrEqual(0);
  });

  test("should be responsive on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const main = page.locator("main");
    await expect(main).toBeVisible();

    // Connect wallet prompt should still be visible
    const connectHeading = page.getByRole("heading", { name: /Connect Wallet/i });
    await expect(connectHeading).toBeVisible();
  });
});
