import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should load homepage successfully", async ({ page }) => {
    await expect(page).toHaveTitle(/Handcraft/i);
  });

  test("should display header with logo", async ({ page }) => {
    const header = page.locator("header");
    await expect(header).toBeVisible();

    // Logo text "Handcraft"
    const logo = page.locator("header").getByText("Handcraft");
    await expect(logo).toBeVisible();
  });

  test("should display hero section with heading", async ({ page }) => {
    const main = page.locator("main");
    await expect(main).toBeVisible();

    // Hero heading
    const heroTitle = page.getByRole("heading", { name: /Own Your Content/i });
    await expect(heroTitle).toBeVisible();
  });

  test("should have Explore Content link", async ({ page }) => {
    const exploreLink = page.getByRole("link", { name: /Explore Content/i });
    await expect(exploreLink).toBeVisible();
  });

  test("should have Start Creating link", async ({ page }) => {
    const studioLink = page.getByRole("link", { name: /Start Creating/i }).first();
    await expect(studioLink).toBeVisible();
  });

  test("should navigate to content page", async ({ page }) => {
    await page.getByRole("link", { name: /Explore Content/i }).click();
    await expect(page).toHaveURL(/\/content/);
  });

  test("should navigate to studio page", async ({ page }) => {
    await page.getByRole("link", { name: /Start Creating/i }).first().click();
    await expect(page).toHaveURL(/\/studio/);
  });

  test("should display wallet connect button", async ({ page }) => {
    // WalletMultiButton shows "Select Wallet" when not connected
    const walletButton = page.getByRole("button", { name: /Select Wallet/i });
    await expect(walletButton).toBeVisible();
  });

  test("should display features section", async ({ page }) => {
    // Feature headings
    await expect(page.getByText("17+ Content Types")).toBeVisible();
    await expect(page.getByText("Bundle Collections")).toBeVisible();
    await expect(page.getByText("On-Chain Ownership")).toBeVisible();
  });

  test("should be responsive on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const main = page.locator("main");
    await expect(main).toBeVisible();

    // Hero should still be visible
    const heroTitle = page.getByRole("heading", { name: /Own Your Content/i });
    await expect(heroTitle).toBeVisible();
  });
});
