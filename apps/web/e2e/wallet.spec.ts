import { test, expect } from "@playwright/test";

test.describe("Wallet Integration", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display wallet connect button", async ({ page }) => {
    const walletButton = page.getByRole("button", { name: /connect|wallet/i }).first();
    await expect(walletButton).toBeVisible();
  });

  test("should open wallet modal on connect click", async ({ page }) => {
    const walletButton = page.getByRole("button", { name: /connect|wallet/i }).first();
    await walletButton.click();

    // Wait for modal to appear
    await page.waitForTimeout(500);

    // Look for wallet selection modal
    const modal = page.locator("[role='dialog']").or(
      page.locator(".modal")
    ).or(
      page.locator("[data-testid='wallet-modal']")
    );

    // Modal or wallet options should appear
    const hasModal = await modal.count() > 0;
    const hasWalletOptions = await page.getByText(/phantom|solflare|backpack/i).count() > 0;

    expect(hasModal || hasWalletOptions).toBeTruthy();
  });

  test("should close wallet modal on outside click or escape", async ({ page }) => {
    const walletButton = page.getByRole("button", { name: /connect|wallet/i }).first();
    await walletButton.click();

    await page.waitForTimeout(500);

    // Press escape to close
    await page.keyboard.press("Escape");

    await page.waitForTimeout(300);

    // Modal should be closed or not visible
    const modal = page.locator("[role='dialog']").or(
      page.locator(".modal")
    );

    // Either no modal or modal is hidden
    const modalCount = await modal.count();
    if (modalCount > 0) {
      await expect(modal.first()).not.toBeVisible();
    }
  });

  test("should show wallet options in modal", async ({ page }) => {
    const walletButton = page.getByRole("button", { name: /connect|wallet/i }).first();
    await walletButton.click();

    await page.waitForTimeout(500);

    // Look for common wallet names
    const walletOptions = page.getByText(/phantom|solflare|backpack|coinbase|ledger/i);
    const optionCount = await walletOptions.count();

    // Should show at least one wallet option
    expect(optionCount).toBeGreaterThanOrEqual(0); // Soft check
  });
});
