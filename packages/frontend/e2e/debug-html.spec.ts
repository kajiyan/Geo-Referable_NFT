import { test } from '@playwright/test'

test('debug: dump page HTML structure', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(3000)

  // Get all HTML
  const html = await page.content()
  console.log('=== FULL PAGE HTML ===')
  console.log(html.substring(0, 10000)) // First 10k chars

  // Get header HTML
  const headerHTML = await page.locator('header').innerHTML().catch(() => 'HEADER NOT FOUND')
  console.log('\n=== HEADER HTML ===')
  console.log(headerHTML)

  // Check for all buttons
  const buttons = await page.locator('button').all()
  console.log('\n=== ALL BUTTONS ===')
  for (const btn of buttons) {
    const text = await btn.textContent().catch(() => 'ERROR')
    const visible = await btn.isVisible().catch(() => false)
    const html = await btn.innerHTML().catch(() => 'ERROR')
    console.log(`Button: "${text}" | Visible: ${visible} | HTML: ${html.substring(0, 100)}`)
  }

  // Check for ConnectButton specifically
  const rainbowkitButtons = await page.locator('[data-testid*="rk"]').all()
  console.log('\n=== RAINBOWKIT ELEMENTS ===')
  console.log('Found', rainbowkitButtons.length, 'RainbowKit elements')

  for (const el of rainbowkitButtons) {
    const testId = await el.getAttribute('data-testid').catch(() => null)
    const visible = await el.isVisible().catch(() => false)
    console.log(`RainbowKit element: ${testId} | Visible: ${visible}`)
  }
})
