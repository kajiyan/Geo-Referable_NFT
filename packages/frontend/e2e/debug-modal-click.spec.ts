import { test } from '@playwright/test'

test('debug: modal state after button click', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(3000)

  console.log('\n=== INITIAL STATE ===')

  // Check if modals exist in DOM before click
  const dialogsBefore = await page.locator('dialog').all()
  console.log(`Dialogs in DOM before click: ${dialogsBefore.length}`)

  for (const dialog of dialogsBefore) {
    const isVisible = await dialog.isVisible().catch(() => false)
    const hasOpen = await dialog.evaluate(el => (el as HTMLDialogElement).hasAttribute('open')).catch(() => false)
    console.log(`Dialog visible: ${isVisible}, has 'open' attr: ${hasOpen}`)
  }

  // Find the New Mint button
  const newMintButton = page.locator('button').filter({ hasText: 'New Mint' })
  const buttonExists = await newMintButton.count()
  console.log(`\nNew Mint button found: ${buttonExists > 0}`)

  if (buttonExists > 0) {
    const buttonVisible = await newMintButton.isVisible()
    console.log(`New Mint button visible: ${buttonVisible}`)

    console.log('\n=== CLICKING BUTTON ===')
    await newMintButton.click()

    // Wait a bit for React state update
    await page.waitForTimeout(500)

    console.log('\n=== STATE AFTER CLICK ===')

    // Check dialogs again
    const dialogsAfter = await page.locator('dialog').all()
    console.log(`Dialogs in DOM after click: ${dialogsAfter.length}`)

    for (const dialog of dialogsAfter) {
      const isVisible = await dialog.isVisible().catch(() => false)
      const hasOpen = await dialog.evaluate(el => (el as HTMLDialogElement).hasAttribute('open')).catch(() => false)
      const innerHTML = await dialog.innerHTML().catch(() => 'ERROR')
      console.log(`Dialog visible: ${isVisible}, has 'open' attr: ${hasOpen}`)
      console.log(`Dialog content (first 200 chars): ${innerHTML.substring(0, 200)}`)
    }

    // Check role="dialog" specifically
    const roleDialogs = await page.locator('[role="dialog"]').all()
    console.log(`\nElements with role="dialog": ${roleDialogs.length}`)

    // Check for modal title
    const modalTitle = await page.locator('text=Mint New Norosi NFT').count()
    console.log(`Modal title found: ${modalTitle > 0}`)

    // Check React state (if we can)
    const bodyHTML = await page.locator('body').innerHTML()
    console.log(`\nBody contains "Mint New Norosi NFT": ${bodyHTML.includes('Mint New Norosi NFT')}`)

    // Try waiting with different strategies
    console.log('\n=== WAIT STRATEGIES ===')

    try {
      await page.locator('dialog[open]').waitFor({ state: 'attached', timeout: 2000 })
      console.log('✅ Found dialog[open] with waitFor attached')
    } catch (e) {
      console.log('❌ No dialog[open] found (attached)')
    }

    try {
      await page.locator('dialog[open]').waitFor({ state: 'visible', timeout: 2000 })
      console.log('✅ Found dialog[open] with waitFor visible')
    } catch (e) {
      console.log('❌ No dialog[open] found (visible)')
    }
  }
})
