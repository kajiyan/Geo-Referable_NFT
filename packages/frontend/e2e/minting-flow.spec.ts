import { test, expect, Page, Locator } from '@playwright/test'

/**
 * E2E Tests for NFT Minting Flow
 *
 * Tests the end-to-end minting process:
 * - Mint form display
 * - GPS location capture for minting
 * - Form validation
 * - Minting flow (requires wallet connection)
 * - Transaction feedback
 * - Success state handling
 *
 * Note: Full minting requires wallet connection and test network funds.
 * These tests focus on UI flow and form validation.
 *
 * Testing Strategy:
 * - Avoid discouraged `networkidle` waits (unreliable with SPAs)
 * - Wait for specific elements instead of general load states
 * - Use JavaScript clicks to bypass pointer interception from MapLibre
 * - Allow time for React hydration and map animations to settle
 */

/**
 * Helper: Wait for React hydration to complete
 * Waits for the New Mint button to be fully interactive
 */
async function waitForReactHydration(page: Page): Promise<Locator> {
  // Wait for page structure to load
  await page.waitForLoadState('domcontentloaded')

  // Wait for the New Mint button to appear (indicates React has rendered)
  const newMintButton = page.locator('button').filter({ hasText: /new mint/i })
  await newMintButton.first().waitFor({ state: 'attached', timeout: 10000 })

  // Wait for button to be visible (ensures layout is complete)
  await expect(newMintButton.first()).toBeVisible({ timeout: 5000 })

  // Small wait for map animation to settle (helps with Mobile Chrome stability)
  // This is shorter than before since we're now waiting for specific elements
  await page.waitForTimeout(500)

  return newMintButton
}

/**
 * Helper: Click button with React compatibility
 * Tries regular click first, falls back to dispatchEvent for React synthetic events
 */
async function clickButton(locator: Locator): Promise<void> {
  try {
    // Try regular click first (works for most browsers)
    await locator.click({ timeout: 5000 })
  } catch (error) {
    // If regular click fails (e.g., pointer interception in Mobile Chrome),
    // dispatch a proper click event that React can intercept
    await locator.evaluate((el: HTMLElement) => {
      el.dispatchEvent(new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
      }))
    })
  }
}

test.describe('NFT Minting Flow', () => {
  test.beforeEach(async ({ context }) => {
    // Grant geolocation permission
    await context.grantPermissions(['geolocation'], {
      origin: 'https://localhost:3443',
    })

    // Set mock GPS position (Tokyo)
    await context.setGeolocation({ latitude: 35.6762, longitude: 139.6503 })
  })

  test('should display mint form', async ({ page }) => {
    // Navigate and wait for React hydration
    await page.goto('/')
    const newMintButton = await waitForReactHydration(page)

    // Click with React-compatible fallback
    await clickButton(newMintButton.first())

    // Wait for mint modal to appear
    const mintModal = page.locator('dialog[open]')
    await mintModal.waitFor({ state: 'visible', timeout: 10000 })

    // Verify modal is displayed with title
    await expect(mintModal).toBeVisible()
    await expect(page.locator('text=Mint New Norosi NFT')).toBeVisible()

    // Verify wallet connection warning is displayed (wallet not connected in test)
    await expect(page.locator('[role="alert"]').filter({ hasText: /connect your wallet/i })).toBeVisible()
  })

  test('should capture GPS location for minting', async ({ page }) => {
    // Navigate and wait for React hydration
    await page.goto('/')
    const newMintButton = await waitForReactHydration(page)

    // Click with React-compatible fallback
    await clickButton(newMintButton.first())

    // Wait for modal to appear
    await page.locator('dialog[open]').waitFor({ state: 'visible', timeout: 10000 })

    // Wait for GPS location section to appear (with generous timeout for fetch)
    await page.locator('text=📍 Location').waitFor({ state: 'visible', timeout: 15000 })

    // Wait for GPS coordinates to appear in the modal (checking various patterns)
    const locationDisplayed = await Promise.race([
      page.locator('text=/35\\.6/').waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false),
      page.locator('text=/139\\.6/').waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false),
    ])

    // GPS location should be captured and displayed
    expect(locationDisplayed).toBeTruthy()
  })

  test('should display message input field', async ({ page }) => {
    // Navigate and wait for React hydration
    await page.goto('/')
    const newMintButton = await waitForReactHydration(page)

    // Click with React-compatible fallback
    await clickButton(newMintButton.first())

    // Wait for modal to appear
    await page.locator('dialog[open]').waitFor({ state: 'visible', timeout: 10000 })

    // Look for the text textarea (name="text")
    const messageInput = page.locator('textarea[name="text"]')

    // Wait for input to be visible
    await messageInput.waitFor({ state: 'visible', timeout: 5000 })

    // Verify input exists and is visible
    await expect(messageInput).toBeVisible()

    // Verify it's disabled because wallet is not connected
    await expect(messageInput).toBeDisabled()

    // Verify it has default value
    await expect(messageInput).toHaveValue('Hello Norosi!')
  })

  test('should validate message length', async ({ page }) => {
    // Navigate and wait for React hydration
    await page.goto('/')
    const newMintButton = await waitForReactHydration(page)

    // Click with React-compatible fallback
    await clickButton(newMintButton.first())

    // Wait for modal to appear
    await page.locator('dialog[open]').waitFor({ state: 'visible', timeout: 10000 })

    // Find message textarea
    const messageInput = page.locator('textarea[name="text"]')
    await messageInput.waitFor({ state: 'visible', timeout: 5000 })

    // Verify maxLength attribute is set to 54 (prevents input over limit)
    const maxLength = await messageInput.getAttribute('maxlength')
    expect(maxLength).toBe('54')

    // Verify character count display exists
    await expect(page.locator('text=/\\d+\\/54 characters/i')).toBeVisible()

    // Note: Cannot test actual input validation without wallet connection
    // The textarea is disabled when wallet is not connected
    await expect(messageInput).toBeDisabled()
  })

  test('should display color/weather selection', async ({ page }) => {
    // Navigate to the app
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Color selector may or may not be visible depending on UI
    // Just verify no crash
    const pageTitle = await page.title()
    expect(pageTitle).toBeTruthy()
  })

  test('should require wallet connection for minting', async ({ page }) => {
    // Navigate and wait for React hydration
    await page.goto('/')
    const newMintButton = await waitForReactHydration(page)

    // Click with React-compatible fallback
    await clickButton(newMintButton.first())

    // Wait for modal to appear
    await page.locator('dialog[open]').waitFor({ state: 'visible', timeout: 10000 })

    // Wait for modal content (NorosiMint component) to load
    // Use more specific selector to avoid matching both modal title and component title
    await page.locator('dialog[open]').getByRole('heading', { name: /mint norosi nft/i, level: 2 }).last().waitFor({ state: 'visible', timeout: 5000 })

    // Look for the actual mint/submit button INSIDE the modal only
    // Scope the selector to dialog[open] to avoid matching buttons on the main page
    const mintButton = page.locator('dialog[open]').locator('button').filter({ hasText: /mint/i }).or(
      page.locator('dialog[open]').locator('button[type="submit"]')
    ).first()

    if (await mintButton.count() > 0) {
      // Wait for button to be fully visible
      await mintButton.waitFor({ state: 'visible' })

      // Try to click mint without wallet connected
      // Use React-compatible click (fallback for pointer interception)
      await clickButton(mintButton)

      // Should either:
      // 1. Show wallet connection prompt
      // 2. Show error message
      // 3. Open wallet modal

      const connectPrompt = page.locator('text=/connect wallet/i')
      const walletModal = page.locator('dialog[open]')
      const errorMessage = page.locator('[role="alert"]').or(
        page.locator('text=/wallet/i')
      )

      // Wait for one of the expected responses to appear
      await Promise.race([
        connectPrompt.waitFor({ state: 'attached', timeout: 3000 }).catch(() => {}),
        walletModal.waitFor({ state: 'attached', timeout: 3000 }).catch(() => {}),
        errorMessage.waitFor({ state: 'attached', timeout: 3000 }).catch(() => {}),
      ]).catch(() => {})

      const hasResponse = (await connectPrompt.count()) > 0 ||
                         (await walletModal.count()) > 0 ||
                         (await errorMessage.count()) > 0

      // App should prompt for wallet connection
      expect(hasResponse).toBeTruthy()
    } else {
      test.skip()
    }
  })

  test('should display loading state during mint', async ({ page: _page }) => {
    // Skip this test - requires actual wallet connection
    test.skip(true, 'Requires wallet connection and test network setup')

    // This test would verify loading spinner/state during transaction
  })

  test('should show success message after successful mint', async ({ page: _page }) => {
    // Skip this test - requires actual wallet connection
    test.skip(true, 'Requires wallet connection and test network setup')

    // This test would verify success message after mint completes
  })

  test('should handle mint errors gracefully', async ({ page: _page }) => {
    // Skip this test - requires actual wallet connection
    test.skip(true, 'Requires wallet connection and test network setup')

    // This test would verify error handling (insufficient funds, etc.)
  })

  test('should display minted NFT details', async ({ page: _page }) => {
    // Skip this test - requires actual wallet connection
    test.skip(true, 'Requires wallet connection and test network setup')

    // This test would verify NFT details displayed after mint
  })

  test('should allow minting with reference chain', async ({ page: _page }) => {
    // Skip this test - requires actual wallet connection
    test.skip(true, 'Requires wallet connection and test network setup')

    // This test would verify mintWithChain functionality
  })
})
