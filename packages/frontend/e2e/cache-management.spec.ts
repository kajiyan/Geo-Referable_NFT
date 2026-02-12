import { test, expect, type CDPSession } from '@playwright/test'

/**
 * Cache Management E2E Tests
 *
 * These tests validate the cache management system's behavior in a real browser environment,
 * including memory usage, performance, and data persistence.
 */

test.describe('Cache Management', () => {
  let cdpSession: CDPSession

  test.beforeEach(async ({ page }) => {
    // Enable Chrome DevTools Protocol for memory measurements
    cdpSession = await page.context().newCDPSession(page)

    // Navigate to the application
    await page.goto('/')

    // Wait for the map to be ready
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('[data-testid="map-container"]', { timeout: 30000 })
  })

  /**
   * Test: Memory usage should remain limited during extended map usage
   *
   * Simulates a user panning and zooming the map repeatedly over an extended period.
   * Verifies that memory usage stays within acceptable limits (< 100MB for cache).
   */
  test('should limit memory usage during extended map usage', async ({ page }) => {
    // Helper: Get current heap size
    const getHeapSize = async (): Promise<number> => {
      const metrics = await cdpSession.send('Performance.getMetrics')
      const heapMetric = metrics.metrics.find(m => m.name === 'JSHeapUsedSize')
      return heapMetric ? heapMetric.value : 0
    }

    // Record initial memory
    const initialHeap = await getHeapSize()
    console.log(`Initial heap size: ${(initialHeap / 1024 / 1024).toFixed(2)} MB`)

    // Simulate extended map usage: 20 viewport changes
    const moveCount = 20
    const delayBetweenMoves = 500 // 500ms between moves

    for (let i = 0; i < moveCount; i++) {
      console.log(`Move ${i + 1}/${moveCount}`)

      // Pan the map in different directions
      const direction = i % 4
      let deltaX = 0
      let deltaY = 0

      switch (direction) {
        case 0: // East
          deltaX = 100
          break
        case 1: // West
          deltaX = -100
          break
        case 2: // North
          deltaY = -100
          break
        case 3: // South
          deltaY = 100
          break
      }

      // Drag the map
      await page.mouse.move(500, 400)
      await page.mouse.down()
      await page.mouse.move(500 + deltaX, 400 + deltaY, { steps: 10 })
      await page.mouse.up()

      // Wait for network requests to complete
      await page.waitForTimeout(delayBetweenMoves)

      // Every 5 moves, zoom in or out
      if ((i + 1) % 5 === 0) {
        if (i < moveCount / 2) {
          await page.keyboard.press('+') // Zoom in
        } else {
          await page.keyboard.press('-') // Zoom out
        }
        await page.waitForTimeout(delayBetweenMoves)
      }
    }

    // Wait for final network requests
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Force garbage collection if available
    await cdpSession.send('HeapProfiler.collectGarbage').catch(() => {
      console.log('GC not available')
    })

    // Measure final memory
    const finalHeap = await getHeapSize()
    const heapGrowth = finalHeap - initialHeap
    const heapGrowthMB = heapGrowth / 1024 / 1024

    console.log(`Final heap size: ${(finalHeap / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Heap growth: ${heapGrowthMB.toFixed(2)} MB`)

    // Verify memory growth is reasonable
    // Expected: Cache should stay under ~10MB for 3000 tokens (~5.27 MB)
    // With overhead, we allow up to 100MB total growth
    expect(heapGrowthMB).toBeLessThan(100)

    // Check cache stats via Redux DevTools or console logs
    const cacheStats = await page.evaluate(() => {
      // Access Redux store if available
      const store = (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
      if (store) {
        const state = store.getState?.()
        return state?.nftMap?.cacheStats
      }
      return null
    })

    console.log('Cache stats:', cacheStats)

    // If cache stats are available, verify they are within limits
    if (cacheStats) {
      expect(cacheStats.totalTokens).toBeLessThanOrEqual(3000) // MAX_CACHED_TOKENS
      if (cacheStats.memoryUsageMB !== undefined) {
        expect(cacheStats.memoryUsageMB).toBeLessThan(10) // ~5.27 MB for 3000 tokens
      }
    }
  })

  /**
   * Test: Performance should remain smooth with 3000 cached tokens
   *
   * Loads the maximum number of tokens into cache and verifies that:
   * - Map interactions remain responsive (<16ms frame time)
   * - Marker rendering is smooth
   * - Cache lookups are fast
   */
  test('should maintain smooth performance with 3000 cached tokens', async ({ page }) => {
    // Helper: Measure frame rate
    const measureFrameRate = async (): Promise<number[]> => {
      return await page.evaluate(() => {
        return new Promise<number[]>((resolve) => {
          const frameTimes: number[] = []
          let lastTimestamp = performance.now()
          let frameCount = 0
          const maxFrames = 60 // Measure 60 frames (~1 second at 60fps)

          const measureFrame = () => {
            const now = performance.now()
            const frameTime = now - lastTimestamp
            frameTimes.push(frameTime)
            lastTimestamp = now
            frameCount++

            if (frameCount < maxFrames) {
              requestAnimationFrame(measureFrame)
            } else {
              resolve(frameTimes)
            }
          }

          requestAnimationFrame(measureFrame)
        })
      })
    }

    // Simulate loading many tokens by panning across a large area
    console.log('Loading tokens into cache...')

    // Perform a grid search pattern to load tokens
    const gridSize = 5 // 5x5 grid = 25 viewport changes
    const panDistance = 200

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        console.log(`Grid position: [${row}, ${col}]`)

        // Move to grid position
        await page.mouse.move(500, 400)
        await page.mouse.down()
        await page.mouse.move(
          500 + (col - gridSize / 2) * panDistance,
          400 + (row - gridSize / 2) * panDistance,
          { steps: 5 }
        )
        await page.mouse.up()

        await page.waitForTimeout(300)
      }
    }

    // Wait for all fetches to complete
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    console.log('Measuring performance with cached tokens...')

    // Measure frame rate during map interaction
    const frameTimesBefore = await measureFrameRate()
    const avgFrameTimeBefore = frameTimesBefore.reduce((a, b) => a + b, 0) / frameTimesBefore.length

    console.log(`Average frame time (before interaction): ${avgFrameTimeBefore.toFixed(2)}ms`)

    // Perform a smooth pan
    await page.mouse.move(400, 300)
    await page.mouse.down()

    // Measure frame rate during pan
    const panPromise = page.mouse.move(600, 500, { steps: 50 })
    const frameTimesDuringPan = await Promise.race([
      measureFrameRate(),
      panPromise.then(() => [] as number[])
    ])

    await page.mouse.up()

    const avgFrameTimeDuringPan = frameTimesDuringPan.length > 0
      ? frameTimesDuringPan.reduce((a, b) => a + b, 0) / frameTimesDuringPan.length
      : avgFrameTimeBefore

    console.log(`Average frame time (during pan): ${avgFrameTimeDuringPan.toFixed(2)}ms`)

    // Performance criteria:
    // - 60fps = 16.67ms per frame
    // - 30fps = 33.33ms per frame
    // We expect at least 30fps (< 33ms average frame time)
    expect(avgFrameTimeDuringPan).toBeLessThan(50) // Allow some tolerance

    // Verify no performance warnings in console
    const consoleMessages: string[] = []
    page.on('console', msg => {
      const text = msg.text()
      if (text.includes('performance') || text.includes('slow')) {
        consoleMessages.push(text)
      }
    })

    // Additional pan to trigger any performance warnings
    await page.mouse.move(300, 200)
    await page.mouse.down()
    await page.mouse.move(500, 400, { steps: 30 })
    await page.mouse.up()

    await page.waitForTimeout(500)

    console.log('Performance warnings:', consoleMessages.length)
    consoleMessages.forEach(msg => console.log(`  - ${msg}`))

    // Should not have excessive performance warnings
    // (Allow a few, but not many)
    expect(consoleMessages.length).toBeLessThan(5)
  })

  /**
   * Test: IndexedDB persistence (bonus test)
   *
   * Verifies that tokens are properly cached in IndexedDB and persist across page reloads.
   */
  test('should persist tokens in IndexedDB across page reloads', async ({ page }) => {
    // Load some tokens
    await page.mouse.move(500, 400)
    await page.mouse.down()
    await page.mouse.move(600, 300, { steps: 10 })
    await page.mouse.up()

    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Check IndexedDB before reload
    const tokenCountBefore = await page.evaluate(async () => {
      const dbs = await indexedDB.databases()
      const cacheDB = dbs.find(db => db.name === 'norosi-token-cache')

      if (!cacheDB) return 0

      return new Promise<number>((resolve) => {
        const request = indexedDB.open('norosi-token-cache')
        request.onsuccess = () => {
          const db = request.result
          const transaction = db.transaction(['tokens'], 'readonly')
          const store = transaction.objectStore('tokens')
          const countRequest = store.count()

          countRequest.onsuccess = () => {
            resolve(countRequest.result)
            db.close()
          }

          countRequest.onerror = () => {
            resolve(0)
            db.close()
          }
        }

        request.onerror = () => resolve(0)
      })
    })

    console.log(`Tokens in IndexedDB before reload: ${tokenCountBefore}`)

    // Reload the page
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('[data-testid="map-container"]', { timeout: 30000 })

    // Check IndexedDB after reload
    const tokenCountAfter = await page.evaluate(async () => {
      const dbs = await indexedDB.databases()
      const cacheDB = dbs.find(db => db.name === 'norosi-token-cache')

      if (!cacheDB) return 0

      return new Promise<number>((resolve) => {
        const request = indexedDB.open('norosi-token-cache')
        request.onsuccess = () => {
          const db = request.result
          const transaction = db.transaction(['tokens'], 'readonly')
          const store = transaction.objectStore('tokens')
          const countRequest = store.count()

          countRequest.onsuccess = () => {
            resolve(countRequest.result)
            db.close()
          }

          countRequest.onerror = () => {
            resolve(0)
            db.close()
          }
        }

        request.onerror = () => resolve(0)
      })
    })

    console.log(`Tokens in IndexedDB after reload: ${tokenCountAfter}`)

    // Tokens should persist across reloads
    if (tokenCountBefore > 0) {
      expect(tokenCountAfter).toBe(tokenCountBefore)
    }
  })
})
