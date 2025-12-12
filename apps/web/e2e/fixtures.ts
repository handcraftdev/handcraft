import { test as base, expect } from "@playwright/test";

/**
 * Custom test fixtures for Handcraft E2E tests
 *
 * Usage:
 * import { test, expect } from "./fixtures";
 *
 * test("my test", async ({ page }) => { ... });
 */

// Extend the base test with custom fixtures
export const test = base.extend<{
  // Add custom fixtures here
}>({
  // Example: auto-navigate to a page
  // page: async ({ page }, use) => {
  //   await page.goto('/');
  //   await use(page);
  // },
});

export { expect };

/**
 * Wait for the app to be fully loaded
 */
export async function waitForAppReady(page: ReturnType<typeof base["page"]>) {
  // Wait for hydration to complete
  await page.waitForLoadState("networkidle");

  // Wait for main content
  await page.locator("main").waitFor({ state: "visible", timeout: 10000 });
}

/**
 * Check if wallet connect button exists
 */
export async function hasWalletButton(page: ReturnType<typeof base["page"]>) {
  const button = page.getByRole("button", { name: /connect|wallet/i }).first();
  return await button.isVisible();
}

/**
 * Click wallet connect button
 */
export async function clickWalletConnect(page: ReturnType<typeof base["page"]>) {
  const button = page.getByRole("button", { name: /connect|wallet/i }).first();
  await button.click();
}

/**
 * Navigate to explore page and wait for load
 */
export async function goToExplore(page: ReturnType<typeof base["page"]>) {
  await page.goto("/explore");
  await waitForAppReady(page);
}

/**
 * Navigate to search page and wait for load
 */
export async function goToSearch(page: ReturnType<typeof base["page"]>) {
  await page.goto("/search");
  await waitForAppReady(page);
}

/**
 * Navigate to dashboard page and wait for load
 */
export async function goToDashboard(page: ReturnType<typeof base["page"]>) {
  await page.goto("/dashboard");
  await waitForAppReady(page);
}

/**
 * Search for content
 */
export async function searchFor(page: ReturnType<typeof base["page"]>, query: string) {
  await goToSearch(page);

  const searchInput = page.getByRole("searchbox").or(
    page.getByPlaceholder(/search/i)
  ).or(
    page.locator("input[type='search']")
  ).or(
    page.locator("input[type='text']").first()
  );

  await searchInput.fill(query);
  await searchInput.press("Enter");

  // Wait for results
  await page.waitForTimeout(1000);
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(
  page: ReturnType<typeof base["page"]>,
  name: string
) {
  await page.screenshot({
    path: `./e2e/screenshots/${name}.png`,
    fullPage: true,
  });
}
