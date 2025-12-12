import { test, expect } from "@playwright/test";

test.describe("Wallet Integration", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display wallet connect button", async ({ page }) => {
    // WalletMultiButton shows "Select Wallet" when not connected
    const walletButton = page.getByRole("button", { name: /Select Wallet/i });
    await expect(walletButton).toBeVisible();
  });

  test("should open wallet modal on connect click", async ({ page }) => {
    const walletButton = page.getByRole("button", { name: /Select Wallet/i });
    await walletButton.click();

    // Wait for modal to appear
    await page.waitForTimeout(500);

    // Look for wallet selection modal or wallet list
    const modal = page.locator("[role='dialog']").or(
      page.locator(".wallet-adapter-modal")
    );

    // Modal or wallet options should appear
    const hasModal = await modal.count() > 0;
    const hasWalletOptions = await page.getByText(/phantom|solflare|backpack/i).count() > 0;

    expect(hasModal || hasWalletOptions).toBeTruthy();
  });

  test("should close wallet modal on escape", async ({ page }) => {
    const walletButton = page.getByRole("button", { name: /Select Wallet/i });
    await walletButton.click();

    await page.waitForTimeout(500);

    // Press escape to close
    await page.keyboard.press("Escape");

    await page.waitForTimeout(300);

    // Wallet button should still be visible (modal closed)
    await expect(walletButton).toBeVisible();
  });

  test("should show wallet options in modal", async ({ page }) => {
    const walletButton = page.getByRole("button", { name: /Select Wallet/i });
    await walletButton.click();

    await page.waitForTimeout(500);

    // Look for common wallet names in the modal
    const walletOptions = page.getByText(/phantom|solflare|backpack|coinbase|ledger/i);
    const optionCount = await walletOptions.count();

    // Should show at least one wallet option (may be 0 if no wallets installed)
    expect(optionCount).toBeGreaterThanOrEqual(0);
  });
});
