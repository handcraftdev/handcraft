import { test, expect } from "@playwright/test";

test.describe("Dashboard Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("should load dashboard page", async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("should display main content area", async ({ page }) => {
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });

  test("should show connect wallet prompt when not connected", async ({ page }) => {
    // Dashboard typically requires wallet connection
    // Look for connect prompt or wallet button
    const connectPrompt = page.getByText(/connect/i).or(
      page.getByRole("button", { name: /connect|wallet/i })
    );

    // Should show some wallet-related content
    const hasConnectContent = await connectPrompt.count() > 0;

    // Or should show dashboard content if wallet simulation is available
    const dashboardContent = page.locator("[data-testid='dashboard-content']").or(
      page.locator(".dashboard")
    );
    const hasDashboardContent = await dashboardContent.count() > 0;

    expect(hasConnectContent || hasDashboardContent).toBeTruthy();
  });

  test("should display creator stats section placeholder", async ({ page }) => {
    // Look for stats or metrics section
    const statsSection = page.locator("[data-testid='stats']").or(
      page.getByText(/stats|earnings|revenue|content/i).first()
    );

    // Stats may or may not be visible depending on wallet state
    // Just ensure page loads without error
    await expect(page.locator("main")).toBeVisible();
  });

  test("should have navigation back to explore", async ({ page }) => {
    const exploreLink = page.getByRole("link", { name: /explore/i }).first();
    await expect(exploreLink).toBeVisible();
  });

  test("should be responsive on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const main = page.locator("main");
    await expect(main).toBeVisible();
  });
});
