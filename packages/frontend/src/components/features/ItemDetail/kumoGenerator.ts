/**
 * kumoGenerator.ts - 日本画風雲グループ生成ロジック
 *
 * 雲 (Kumo) = Cloud in Japanese
 *
 * Generates procedural cloud groups with:
 * - Multiple horizontal pill-shaped lines (2-3 lines per group)
 * - Bracket connectors (「」) linking lines
 * - Seeded randomization for consistent but varied patterns
 *
 * Design principles:
 * - Silver Ratio (√2 ≈ 1.414): Japanese aesthetic proportion
 * - Golden Ratio (φ ≈ 1.618): Universal harmonic proportion
 * - Ma (間): Negative space between cloud groups
 */

// ============================================
// Mathematical Constants
// ============================================

/** Silver Ratio - √2, common in Japanese aesthetics (tatami, A4 paper) */
const SILVER_RATIO = Math.SQRT2; // ≈ 1.414

/** Golden Ratio - φ, universal harmonic proportion */
const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2; // ≈ 1.618

/** Inverse Golden Ratio - 1/φ, for positioning */
const INVERSE_PHI = 1 / GOLDEN_RATIO; // ≈ 0.618

// ============================================
// Layout Constants (derived from design specs)
// ============================================

/** Actual rect height - shared with KumoCloud.tsx */
export const RECT_HEIGHT = 24;

/** Pill radius (half of rect height for perfect pill ends) */
export const LINE_RADIUS = RECT_HEIGHT / 2; // 12

/** Gap between rect edges (connector height - 2 × overlap for proper junction) */
const RECT_GAP = 8; // 10 (connector height) - 2 × 1 (overlap) = 8

// ============================================
// Types
// ============================================

/**
 * Single horizontal line in a cloud group
 */
export interface KumoLine {
  x: number; // Start X coordinate
  y: number; // Y coordinate
  width: number; // Line width
}

/**
 * Axis-aligned bounding box for collision detection
 */
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * A cloud group consisting of 2-3 lines connected by brackets
 */
export interface KumoGroup {
  id: string;
  lines: KumoLine[]; // 2-3 horizontal lines
  connectorX: number; // Bracket connector X position
  connectorY: number; // Bracket connector Y position (between lines)
  connectorWidth: number; // Width of bracket connector span
  bounds: BoundingBox; // Bounding box for collision detection
}

// ============================================
// Seeded Random Number Generator
// ============================================

/**
 * Mulberry32 - Fast seeded PRNG
 * @param seed - Integer seed value
 * @returns Function that returns random number between 0-1
 */
function seededRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================
// Collision Detection Helpers
// ============================================

/** Minimum gap between cloud bounding boxes (Ma - negative space) */
const MIN_CLOUD_GAP = 20;

/**
 * Calculate bounding box for a set of cloud lines
 */
function calculateBounds(lines: KumoLine[]): BoundingBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const line of lines) {
    minX = Math.min(minX, line.x);
    minY = Math.min(minY, line.y);
    maxX = Math.max(maxX, line.x + line.width);
    maxY = Math.max(maxY, line.y + RECT_HEIGHT);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Check if two bounding boxes overlap (with gap consideration)
 */
function boxesOverlap(a: BoundingBox, b: BoundingBox, gap: number = MIN_CLOUD_GAP): boolean {
  return !(
    a.maxX + gap < b.minX ||
    b.maxX + gap < a.minX ||
    a.maxY + gap < b.minY ||
    b.maxY + gap < a.minY
  );
}

/**
 * Check if a bounding box overlaps with any existing clouds
 */
function hasCollision(bounds: BoundingBox, existingClouds: KumoGroup[]): boolean {
  for (const cloud of existingClouds) {
    if (boxesOverlap(bounds, cloud.bounds)) {
      return true;
    }
  }
  return false;
}

// ============================================
// Cloud Group Generator
// ============================================

/**
 * Configuration for cloud generation
 */
interface GeneratorConfig {
  /** Base line width for top line (smallest) */
  baseMinWidth: number;
  baseMaxWidth: number;
  /** Rect height (must match KumoCloud LINE_HEIGHT) */
  lineHeight: number;
  /** Gap between rect edges (CONNECTOR_HEIGHT - OVERLAP * 2) */
  lineGap: number;
  /** Bracket connector width */
  connectorWidth: number;
  /** Probability of generating 3-line cloud (0-1) */
  threeLineProbability: number;
}

const DEFAULT_CONFIG: GeneratorConfig = {
  baseMinWidth: 80,
  baseMaxWidth: 130,
  lineHeight: RECT_HEIGHT,
  lineGap: RECT_GAP,
  connectorWidth: 28,
  threeLineProbability: 0.4,
};

/** Maximum placement attempts per cloud before giving up */
const MAX_PLACEMENT_ATTEMPTS = 15;

/**
 * Generate a single cloud group at a given position
 */
function generateCloudAtPosition(
  baseX: number,
  baseY: number,
  seed: number,
  index: number,
  random: () => number,
  cfg: GeneratorConfig,
  lineCount: number // Pre-determined line count to match Y calculation
): KumoGroup {

  // Generate lines with Silver Ratio width progression + randomness
  // Top line is smallest, each lower line grows by √2 (with variation)
  const topWidth = Math.round(cfg.baseMinWidth + random() * (cfg.baseMaxWidth - cfg.baseMinWidth));
  const lines: KumoLine[] = [];

  for (let j = 0; j < lineCount; j++) {
    // Width grows by Silver Ratio with ±15% random variation
    const ratioVariation = 0.85 + random() * 0.3; // 0.85 to 1.15
    const widthMultiplier = Math.pow(SILVER_RATIO, j) * ratioVariation;
    const width = Math.round(topWidth * widthMultiplier);

    // Horizontal offset: shifts with golden ratio base + random variation
    // Random direction (left or right) for more organic feel
    const offsetDirection = random() > 0.5 ? 1 : -1;
    const offsetVariation = 0.5 + random() * 1.0; // 0.5 to 1.5
    const xOffset = Math.round(
      j === 0 ? 0 : offsetDirection * topWidth * INVERSE_PHI * 0.25 * j * offsetVariation
    );

    lines.push({
      x: Math.round(baseX + xOffset),
      y: baseY + j * (cfg.lineHeight + cfg.lineGap), // Already integers
      width,
    });
  }

  // Calculate bracket connector position
  // Position within the "safe zone" - avoiding rounded corners (rx = LINE_RADIUS)
  const firstLine = lines[0];
  const secondLine = lines[1];

  // Find overlap region between first two lines, excluding rounded corners
  // Safe zone starts after rx and ends before rx on each line
  const safeStart = Math.max(firstLine.x + LINE_RADIUS, secondLine.x + LINE_RADIUS);
  const safeEnd = Math.min(
    firstLine.x + firstLine.width - LINE_RADIUS,
    secondLine.x + secondLine.width - LINE_RADIUS
  );
  const safeWidth = Math.max(0, safeEnd - safeStart - cfg.connectorWidth);

  // Position connector at φ point (golden ratio) within safe zone - rounded to integer
  const connectorX = Math.round(safeStart + safeWidth * INVERSE_PHI * 0.5 + random() * safeWidth * 0.3);
  // Connector Y is at the bottom edge of the first rect
  const connectorY = firstLine.y + RECT_HEIGHT;

  // Calculate bounding box
  const bounds = calculateBounds(lines);

  return {
    id: `kumo-${seed}-${index}`,
    lines,
    connectorX,
    connectorY,
    connectorWidth: cfg.connectorWidth,
    bounds,
  };
}

/**
 * Generate cloud groups with seeded randomization and collision avoidance
 * Uses Silver Ratio for line width progression
 *
 * @param seed - Random seed for consistent generation
 * @param count - Number of cloud groups to generate
 * @param viewWidth - Width of the viewBox
 * @param viewHeight - Height of the viewBox
 * @param config - Optional generation configuration
 * @returns Array of KumoGroup objects (may be fewer than count if collisions unavoidable)
 */
export function generateKumoGroups(
  seed: number,
  count: number,
  viewWidth: number,
  viewHeight: number,
  config: Partial<GeneratorConfig> = {}
): KumoGroup[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const random = seededRandom(seed);
  const groups: KumoGroup[] = [];

  // Calculate spacing with Ma (間) principle - balanced negative space
  // 85% for clouds, 15% for Ma
  const totalCloudSpace = viewWidth * 0.85;
  const segmentWidth = totalCloudSpace / count;
  const startOffset = viewWidth * 0.05; // 5% margin at start

  for (let i = 0; i < count; i++) {
    let placed = false;

    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS && !placed; attempt++) {
      // Position within segment (with randomness) - rounded to integer
      const segmentStart = startOffset + i * segmentWidth;
      // More randomness on retry attempts
      const xVariance = attempt === 0 ? 0.4 : 0.8;
      const baseX = Math.round(segmentStart + random() * segmentWidth * xVariance);

      // Calculate vertical position
      // 2-line clouds get more Y freedom, 3-line clouds are more constrained
      const lineCount = random() < cfg.threeLineProbability ? 3 : 2;
      const totalCloudHeight = lineCount * cfg.lineHeight + (lineCount - 1) * cfg.lineGap;

      // Dynamic margins based on line count
      const topMargin = lineCount === 2 ? 5 : 12;
      const bottomMargin = lineCount === 2 ? 8 : 16;
      const maxY = viewHeight - totalCloudHeight - bottomMargin;

      // Full Y range for natural distribution
      const yRange = Math.max(0, maxY - topMargin);
      const baseY = Math.round(topMargin + random() * yRange);

      // Generate candidate cloud with pre-determined lineCount
      const candidate = generateCloudAtPosition(baseX, baseY, seed, i, random, cfg, lineCount);

      // Check for collisions with existing clouds
      if (!hasCollision(candidate.bounds, groups)) {
        groups.push(candidate);
        placed = true;
      }
      // If collision, loop will try again with new random position
    }
    // If placement failed after all attempts, skip this cloud (Ma - intentional gap)
  }

  return groups;
}

/**
 * Cloud layer configuration for parallax effect
 */
export interface CloudLayerConfig {
  seed: number;
  count: number;
  speed: number; // Animation duration in seconds
  yOffset: number; // Y offset for parallax effect
  opacity?: number;
}

/**
 * Generate multiple layers of clouds with different parameters
 *
 * @param layerConfigs - Array of layer configurations
 * @param viewWidth - Width of the viewBox
 * @param viewHeight - Height of the viewBox
 * @returns Array of layers, each containing cloud groups
 */
export function generateCloudLayers(
  layerConfigs: CloudLayerConfig[],
  viewWidth: number,
  viewHeight: number
): Array<CloudLayerConfig & { groups: KumoGroup[] }> {
  return layerConfigs.map((layer) => ({
    ...layer,
    groups: generateKumoGroups(layer.seed, layer.count, viewWidth, viewHeight),
  }));
}
