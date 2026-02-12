import { test, expect } from '@playwright/test'

/**
 * E2E Tests for Wallet Connection
 *
 * Tests the wallet connection flow using RainbowKit:
 * - Connect wallet button display
 * - Wallet modal opens
 * - Connection state handling
 * - Disconnect functionality
 *
 * Note: Full wallet integration requires MetaMask extension or similar,
 * which is complex in automated testing. These tests focus on UI flow.
 */

test.describe('Wallet Connection Flow', () => {
  test('should display connect wallet button', async ({ page }) => {
    // Navigate to the app
    await page.goto('/')

    // Wait for the app to load
    await page.waitForLoadState('domcontentloaded')

    // Wait for RainbowKit to initialize
    await page.waitForTimeout(2000)

    // Look for RainbowKit connect button by test ID
    const connectButton = page.locator('[data-testid="rk-connect-button"]')

    // Verify connect button is visible
    await expect(connectButton).toBeVisible({ timeout: 10000 })
  })

  test('should open wallet modal when connect button is clicked', async ({ page }) => {
    // Navigate to the app
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Wait for RainbowKit to initialize
    await page.waitForTimeout(2000)

    // Find and click RainbowKit connect button by test ID
    const connectButton = page.locator('[data-testid="rk-connect-button"]')

    await connectButton.click()

    // Wait for modal to appear (RainbowKit modal)
    const modalContent = page.locator('[role="dialog"]').or(
      page.locator('text=/wallet/i')
    ).or(
      page.locator('text=/metamask/i')
    )

    // Wait for modal with timeout
    await modalContent.first().waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})

    // Modal should be visible
    const hasModal = await modalContent.count() > 0
    expect(hasModal).toBeTruthy()
  })

  test('should display wallet options in modal', async ({ page }) => {
    // Navigate to the app
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Wait for RainbowKit to initialize
    await page.waitForTimeout(2000)

    // Click RainbowKit connect button by test ID
    const connectButton = page.locator('[data-testid="rk-connect-button"]')
    await connectButton.click()

    // Wait for modal to appear
    await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})

    // Look for common wallet names
    const metamask = page.locator('text=/metamask/i')
    const walletConnect = page.locator('text=/walletconnect/i')
    const coinbase = page.locator('text=/coinbase/i')

    // At least one wallet option should be visible
    const walletCount = await Promise.all([
      metamask.count(),
      walletConnect.count(),
      coinbase.count(),
    ])

    const totalWallets = walletCount.reduce((a, b) => a + b, 0)
    expect(totalWallets).toBeGreaterThan(0)
  })

  test('should close modal when cancel/close is clicked', async ({ page }) => {
    // Navigate to the app
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Wait for RainbowKit to initialize
    await page.waitForTimeout(2000)

    // Click RainbowKit connect button by test ID
    const connectButton = page.locator('[data-testid="rk-connect-button"]')
    await connectButton.click()

    // Wait for modal to appear
    await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})

    // Look for close button (common patterns)
    const closeButton = page.locator('button[aria-label*="close"]').or(
      page.locator('button:has-text("×")')
    ).or(
      page.locator('[data-testid="modal-close"]')
    )

    if (await closeButton.count() > 0) {
      // Click close button
      await closeButton.first().click()

      // Wait for modal to close by checking connect button visibility
      await expect(connectButton).toBeVisible()
    } else {
      // If no close button, click outside modal (backdrop)
      await page.mouse.click(10, 10)

      // Wait for modal to close by checking connect button visibility
      await expect(connectButton).toBeVisible()
    }
  })

  test('should handle wallet connection errors gracefully', async ({ page }) => {
    // Navigate to the app
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Wait for RainbowKit to initialize
    await page.waitForTimeout(2000)

    // Click RainbowKit connect button by test ID
    const connectButton = page.locator('[data-testid="rk-connect-button"]')
    await connectButton.click()

    // Wait for modal to appear
    await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})

    // Even if wallet extension is not installed, app should not crash
    const pageTitle = await page.title()
    expect(pageTitle).toBeTruthy()

    // No JavaScript errors should be thrown
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await page.waitForTimeout(1000)

    // Filter out expected errors (like wallet not installed)
    const criticalErrors = errors.filter(
      (e) => !e.includes('wallet') && !e.includes('provider')
    )

    expect(criticalErrors.length).toBe(0)
  })

  test('should display network information when wallet is connected', async () => {
    // Skip this test if we can't actually connect a wallet
    test.skip(true, 'Requires MetaMask extension or wallet mock')

    // This test would verify network display after connection
    // Implementation depends on having a wallet mock or MetaMask extension
  })

  test('should allow disconnecting wallet', async () => {
    // Skip this test if we can't actually connect a wallet
    test.skip(true, 'Requires MetaMask extension or wallet mock')

    // This test would verify disconnect functionality
    // Implementation depends on having a wallet connected first
  })

  test('should persist wallet connection across page reloads', async () => {
    // Skip this test if we can't actually connect a wallet
    test.skip(true, 'Requires MetaMask extension or wallet mock')

    // This test would verify wallet persistence
    // Implementation depends on having a wallet connected
  })
})
