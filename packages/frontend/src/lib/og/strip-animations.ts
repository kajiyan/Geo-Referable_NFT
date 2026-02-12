/**
 * Strips CSS animations from Fumi.sol-generated SVG to produce a static frame.
 *
 * Removes:
 * - @keyframes rules (riseMain, riseParent) — handles nested braces
 * - animation: properties
 * - .static display:none rules
 */
export function stripAnimations(svg: string): string {
  let result = svg

  // Remove @keyframes blocks (handles nested braces like `@keyframes x{to{...}}`)
  result = result.replace(/@keyframes\s+\w+\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g, '')

  // Remove animation: properties from style rules
  result = result.replace(/animation:[^;}"]+[;]?/g, '')

  // Remove .static hiding rules (lenient whitespace)
  result = result.replace(/\.static\s[^{]*\{\s*display\s*:\s*none\s*;?\s*\}/g, '')

  // Remove class="static" from root SVG element (if colorIndex==13)
  result = result.replace(/\s+class="static"/, '')

  return result
}
