import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import styles from './openfreemap.module.css'

/**
 * Layout box height constants derived from CSS.
 * Used for accurate margin compensation when scale transform is applied.
 *
 * CSS transform: scale() affects visual rendering but NOT the layout box.
 * The Marker component positions based on the layout box, so we need to
 * compensate with negative margins to align the visual element with the anchor.
 *
 * @see openfreemap.module.css for CSS values
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/transform
 */
/** Marquee text line height: font-size 24px × line-height calc(32/24) */
const MARQUEE_LINE_HEIGHT = 32

/** Number badge line height: font-size 32px × line-height 1.5 */
const NUMBER_LINE_HEIGHT = 48

/** Gap between marquee and number badge in .ofm-marquee-wrap */
const WRAP_GAP = 4

/** Vertical padding in .ofm-marquee-wrap: padding 4px 0 (top + bottom) */
const WRAP_PADDING_VERTICAL = 8

type Props = {
  text: string
  /** Seconds to scroll 100px (lower = faster). Maintains consistent speed regardless of text length. Default: 10 */
  speed?: number
  onActivate?: () => void
  /** Fixed button width in px (pre-rotation). Prevents feedback loops. Default: 140 */
  width?: number
  /** Extra gap (px) between repeated copies. Default: 12 */
  gap?: number
  /** Respect OS-level reduce motion. Default: false */
  respectReducedMotion?: boolean
  /** Optional number label shown under the marquee, prefixed with '#'. Max 3 digits. */
  badgeNumber?: number
  /** Optional scale applied to the whole component (root wrapper). Default: 1 */
  scale?: number
  /** Optional background color for the marquee (e.g., from TOKEN_COLORS). */
  bgColor?: string
  /** Night mode — switches badge number text to white. */
  isNight?: boolean
}

export default function MapMarquee({ text, speed = 10, onActivate, width = 140, gap = 12, respectReducedMotion = false, badgeNumber, scale = 1, bgColor, isNight }: Props) {
  const rootRef = useRef<HTMLButtonElement | null>(null)
  const spanRef = useRef<HTMLSpanElement | null>(null)
  const [unitWidth, setUnitWidth] = useState(0)
  const [ready, setReady] = useState(false)
  const [visible, setVisible] = useState(true)
  
  // Performance monitoring
  const performanceRef = useRef({
    fontLoadStart: performance.now(),
    measurementStart: 0,
    animationStart: 0
  })

  const handleActivate = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onActivate?.()
    },
    [onActivate],
  )

  /**
   * Stops pointer/touch event propagation to prevent react-map-gl drag detection interference.
   *
   * Without this, the Map component enters a dragging state when clicking on markers,
   * which causes issues with the click event lifecycle:
   * - react-map-gl uses pointerdown internally for drag detection
   * - If pointerdown propagates to Map, it starts tracking a potential drag
   * - When click fires on the marker (with stopPropagation), the drag never completes
   *
   * @see https://visgl.github.io/react-map-gl/docs/api-reference/marker
   */
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
  }, [])

  /**
   * Stops touchstart propagation for Chrome DevTools mobile emulation and real touch devices.
   * Touch event sequence: touchstart → touchmove → touchend → click (synthetic)
   */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation()
  }, [])

  const measure = useCallback(() => {
    const spanEl = spanRef.current
    if (!spanEl) return
    
    const el = spanEl as HTMLElement
    const prev = el.style.width
    el.style.width = 'auto'
    
    const rawW = el.scrollWidth || el.getBoundingClientRect().width
    el.style.width = prev
    
    const w = Math.ceil(rawW)
    
    // Only update if we get a reasonable measurement
    if (w > 0) {
      setUnitWidth((prev) => (prev !== w ? w : prev))
    } else {
      // Retry measurement after a short delay if we get 0 width
      setTimeout(() => {
        if (spanRef.current) {
          const retryW = Math.ceil(spanRef.current.scrollWidth || spanRef.current.getBoundingClientRect().width)
          if (retryW > 0) {
            setUnitWidth((prev) => (prev !== retryW ? retryW : prev))
          }
        }
      }, 50)
    }
  }, [])

  useLayoutEffect(() => {
    measure()
    const t = setTimeout(measure, 0)
    return () => clearTimeout(t)
  }, [text, measure])

  useEffect(() => {
    const spanTarget = spanRef.current
    if (!spanTarget) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(spanTarget)
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [measure])

  // Pause animation when not visible in viewport using IntersectionObserver
  // Add an "arming" delay so initial layout/portals don't incorrectly pause animation
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return

    let armed = false
    const armTimer = setTimeout(() => { armed = true }, 600)

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        const isIntersecting = entry.isIntersecting && entry.intersectionRatio > 0
        if (isIntersecting) {
          setVisible(true)
        } else if (armed) {
          // Only pause after the initial mount/relayout window
          setVisible(false)
        }
      },
      { root: null, threshold: [0, 0.01] },
    )
    io.observe(el)
    return () => {
      clearTimeout(armTimer)
      io.disconnect()
    }
  }, [])

  useEffect(() => {
    const loadFontsAndMeasure = async () => {
      try {
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready
          measure()
        } else {
          setTimeout(measure, 100)
        }
      } catch (error) {
        console.warn('Font loading detection failed, using fallback:', error)
        setTimeout(measure, 100)
      }
    }
    
    loadFontsAndMeasure()
  }, [measure, text])

  useEffect(() => {
    const checkReadyState = () => {
      const hasValidWidth = unitWidth > 0
      const fontsLoaded = !document.fonts || document.fonts.status === 'loaded'
      const shouldBeReady = hasValidWidth && fontsLoaded

      setReady(shouldBeReady)
    }

    checkReadyState()

    // Re-check when fonts finish loading
    if (document.fonts) {
      document.fonts.addEventListener('loadingdone', checkReadyState)
      return () => {
        document.fonts.removeEventListener('loadingdone', checkReadyState)
      }
    }
    return undefined
  }, [unitWidth])

  useEffect(() => {
    if (ready) setVisible(true)
  }, [ready])

  useEffect(() => {
    if (ready && visible) {
      performanceRef.current.animationStart = performance.now()
      if (process.env.NODE_ENV === 'development') {
        const totalTime = performanceRef.current.animationStart - performanceRef.current.fontLoadStart
        console.log(`[MapMarquee] Animation started after ${totalTime.toFixed(0)}ms`)
      }
    }
  }, [ready, visible])

  // Development-only font loading status logging
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return undefined
    if (!document.fonts) return undefined

    const logFontStatus = () => {
      console.log('[MapMarquee] Font loading status:', {
        status: document.fonts.status,
        size: document.fonts.size,
      })
    }

    document.fonts.addEventListener('loadingdone', logFontStatus)
    document.fonts.addEventListener('loadingerror', logFontStatus)

    return () => {
      document.fonts.removeEventListener('loadingdone', logFontStatus)
      document.fonts.removeEventListener('loadingerror', logFontStatus)
    }
  }, [])

  const contentBase = Math.max(1, unitWidth)
  const base = contentBase + (gap || 0)
  const period = base

  // Calculate animation duration to maintain consistent visual speed
  // regardless of text length. Speed prop is "seconds per 100px".
  // This ensures both short and long text scroll at the same px/s rate.
  const BASE_PIXELS = 100
  const actualDuration = (period / BASE_PIXELS) * speed

  const style: React.CSSProperties & Record<string, string> = {
    '--ofm-ad': `${actualDuration}s`,
    '--ofm-unit': `${period}px`,
    '--ofm-gap': `${gap}px`,
  }

  const unitText = `${text}\u3000`

  const numberText = useMemo(() => {
    if (badgeNumber === undefined || badgeNumber === null) return null
    const n = Math.max(0, Math.min(999, Math.floor(badgeNumber)))
    return `#${n}`
  }, [badgeNumber])

  // Decide how many units to render to visually fill the container plus buffer
  const repeatCount = useMemo(() => {
    if (!unitWidth) return 0
    const n = Math.ceil(width / period) + 4 // cover viewport + buffer while shifting by one period
    return Math.max(4, n)
  }, [unitWidth, period, width])

  // Calculate layout box height based on badge presence
  // This is used for accurate margin compensation when scale transform is applied
  const layoutBoxHeight = MARQUEE_LINE_HEIGHT
    + WRAP_PADDING_VERTICAL
    + (numberText ? NUMBER_LINE_HEIGHT + WRAP_GAP : 0)

  // Calculate margin compensation for scale transform
  // CSS transform: scale() shrinks towards transformOrigin (right bottom),
  // creating unused space that must be compensated with negative margins
  const marginLeft = -width * (1 - scale)
  const marginTop = -layoutBoxHeight * (1 - scale)

  /**
   * Wrapper pattern for CSS transform scale with layout box correction.
   *
   * Problem: CSS transform: scale() affects visual rendering and hit testing,
   * but does NOT affect the element's layout box. The Marker component positions
   * based on the layout box, causing invisible clickable areas.
   *
   * Solution:
   * 1. Outer div: Applies transform with pointer-events: none
   * 2. Inner button: Has pointer-events: auto (only visible area is clickable)
   * 3. Negative margins: Shrink layout box to match visual size
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/transform
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events
   */
  return (
    <div
      style={{
        transform: `scale(${scale})`,
        transformOrigin: 'right bottom',
        pointerEvents: 'none',
        // Compensate for unused space created by scale transform
        marginLeft,
        marginTop,
      }}
    >
      <button
        ref={rootRef}
        type="button"
        className={styles['ofm-marquee-wrap']}
        onClick={handleActivate}
        onTouchEnd={handleActivate}
        onTouchStart={handleTouchStart}
        onPointerDown={handlePointerDown}
        aria-label={numberText ? `${text} ${numberText}` : text}
      >
        <div
          className={`${styles['ofm-marquee']} ${styles['ofm-marquee--rotated']}`}
          data-ready={ready ? 'true' : 'false'}
          data-visible={visible ? 'true' : 'false'}
          data-respect-rm={respectReducedMotion ? 'true' : 'false'}
          style={{ ...style, width: `${width}px`, ...(bgColor ? { backgroundColor: bgColor } : {}) }}
        >
          <span
            className={styles['ofm-marquee__track']}
            aria-hidden={!ready}
            style={{
              animationPlayState: ready && visible ? 'running' : 'paused',
              willChange: visible ? ('transform' as const) : undefined,
            }}
          >
            <span ref={spanRef} className={styles['ofm-marquee__unit']}>{unitText}</span>
            {Array.from({ length: Math.max(0, repeatCount - 1) }).map((_, i) => (
              <span className={styles['ofm-marquee__unit']} key={i}>{unitText}</span>
            ))}
          </span>
        </div>
        {numberText && (
          <div
            className={styles['ofm-marquee__num']}
            aria-hidden={!ready}
            style={{ willChange: ready && visible ? ('transform' as const) : undefined, color: isNight ? '#fff' : undefined }}
          >
            {numberText}
          </div>
        )}
      </button>
    </div>
  )
}
