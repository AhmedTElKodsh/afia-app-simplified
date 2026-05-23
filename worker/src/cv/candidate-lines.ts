export interface BottleRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HorizontalLineEvidence {
  y: number;
  strength: number;
  source?: "sobel_row" | "hough_segment" | "ransac_cluster" | "labeled_mask";
  /** ROI-relative horizontal run start, when known. */
  xStart?: number;
  /** ROI-relative horizontal run end, when known. */
  xEnd?: number;
  /** Absolute line angle in degrees. Zero is horizontal. */
  angleDeg?: number;
  inlierCount?: number;
}

export interface LiquidLineCandidate {
  id: string;
  y: number;
  yRatioInBottle: number;
  score: number;
  edgeStrength: number;
  horizontalCoverage: number | null;
  source: "sobel_row" | "hough_segment" | "ransac_cluster" | "labeled_mask" | "unknown";
  angleDeg: number | null;
  inlierCount: number | null;
  reason: string;
}

export interface CandidateLineInput {
  bottleRect: BottleRect;
  edges: HorizontalLineEvidence[];
  imageWidth: number;
  imageHeight: number;
  topN?: number;
  minScore?: number;
  minEdgeStrength?: number;
}

const DEFAULT_TOP_N = 3;
const DEFAULT_MIN_SCORE = 0.05;
const DEFAULT_MIN_EDGE_STRENGTH = 100;
const DEFAULT_RANSAC_TOLERANCE_PX = 4;
const DEFAULT_RANSAC_MIN_INLIERS = 2;

export function proposeLiquidLineCandidates(input: CandidateLineInput): LiquidLineCandidate[] {
  if (input.bottleRect.w <= 0 || input.bottleRect.h <= 0 || input.edges.length === 0) {
    return [];
  }

  const maxStrength = Math.max(...input.edges.map((edge) => Math.max(0, edge.strength)), 1);
  const minScore = input.minScore ?? DEFAULT_MIN_SCORE;
  const minEdgeStrength = input.minEdgeStrength ?? DEFAULT_MIN_EDGE_STRENGTH;
  const topN = Math.max(0, Math.floor(input.topN ?? DEFAULT_TOP_N));
  if (topN === 0) return [];

  return input.edges
    .map((edge, index) => scoreCandidate(input, edge, index, maxStrength))
    .filter((candidate) => candidate.edgeStrength >= minEdgeStrength)
    .filter((candidate) => candidate.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

export function selectBestLiquidLineCandidate(candidates: LiquidLineCandidate[]): LiquidLineCandidate | null {
  return candidates[0] ?? null;
}

function scoreCandidate(
  input: CandidateLineInput,
  edge: HorizontalLineEvidence,
  index: number,
  maxStrength: number,
): LiquidLineCandidate {
  const rect = input.bottleRect;
  const yRatioInBottle = clamp(edge.y / rect.h, 0, 1);
  const edgeScore = clamp(edge.strength / maxStrength, 0, 1);
  const fillableBandPlausibility = yRatioInBottle >= 0.08 && yRatioInBottle <= 0.92 ? 1 : 0.65;
  const horizontalCoverage = computeHorizontalCoverage(edge, rect);
  const coverageScore = horizontalCoverage ?? 0;
  const angleScore = edge.angleDeg === undefined ? 0.75 : clamp(1 - Math.abs(edge.angleDeg) / 18, 0, 1);
  const inlierScore = edge.inlierCount === undefined ? 0 : clamp(edge.inlierCount / 6, 0, 1);
  const sourceBonus = edge.source === "labeled_mask" ? 0.25 : edge.source === "ransac_cluster" ? 0.05 : edge.source === "hough_segment" ? 0.03 : 0;
  const boundaryPenalty = yRatioInBottle < 0.08 || yRatioInBottle > 0.92 ? 0.55 : 0;
  const score = clamp(
    edgeScore * 0.5
      + coverageScore * 0.18
      + fillableBandPlausibility * 0.16
      + angleScore * 0.08
      + inlierScore * 0.05
      + sourceBonus
      - boundaryPenalty,
    0,
    1,
  );
  const reasonParts = [
    "edge_strength",
    "fillable_band",
    horizontalCoverage === null ? "coverage_unknown" : "coverage",
  ];
  if (edge.source) reasonParts.push(edge.source);
  if (edge.inlierCount !== undefined) reasonParts.push(`inliers_${edge.inlierCount}`);

  return {
    id: `line-${index}`,
    y: round1(rect.y + edge.y),
    yRatioInBottle: round4(yRatioInBottle),
    score: round4(score),
    edgeStrength: edge.strength,
    horizontalCoverage: horizontalCoverage === null ? null : round4(horizontalCoverage),
    source: edge.source ?? "unknown",
    angleDeg: edge.angleDeg === undefined ? null : round1(edge.angleDeg),
    inlierCount: edge.inlierCount ?? null,
    reason: reasonParts.join("+"),
  };
}

export function fitRansacHorizontalEvidence(
  edges: HorizontalLineEvidence[],
  options: { tolerancePx?: number; minInliers?: number } = {},
): HorizontalLineEvidence | null {
  const tolerancePx = options.tolerancePx ?? DEFAULT_RANSAC_TOLERANCE_PX;
  const minInliers = options.minInliers ?? DEFAULT_RANSAC_MIN_INLIERS;
  const usable = edges.filter((edge) => Number.isFinite(edge.y) && edge.strength > 0);
  if (usable.length < minInliers) return null;

  let best: HorizontalLineEvidence[] = [];
  let bestStrength = -1;
  for (const seed of usable) {
    const inliers = usable.filter((edge) => Math.abs(edge.y - seed.y) <= tolerancePx);
    const strength = inliers.reduce((sum, edge) => sum + edge.strength, 0);
    if (inliers.length > best.length || (inliers.length === best.length && strength > bestStrength)) {
      best = inliers;
      bestStrength = strength;
    }
  }

  if (best.length < minInliers) return null;
  const weightSum = Math.max(1, best.reduce((sum, edge) => sum + edge.strength, 0));
  const y = best.reduce((sum, edge) => sum + edge.y * edge.strength, 0) / weightSum;
  const starts = best.map((edge) => edge.xStart).filter((v): v is number => v !== undefined);
  const ends = best.map((edge) => edge.xEnd).filter((v): v is number => v !== undefined);
  return {
    y,
    strength: Math.round(weightSum / best.length),
    source: "ransac_cluster",
    xStart: starts.length ? Math.min(...starts) : undefined,
    xEnd: ends.length ? Math.max(...ends) : undefined,
    angleDeg: 0,
    inlierCount: best.length,
  };
}

function computeHorizontalCoverage(edge: HorizontalLineEvidence, rect: BottleRect): number | null {
  if (edge.xStart === undefined || edge.xEnd === undefined) return null;
  const start = clamp(edge.xStart, 0, rect.w);
  const end = clamp(edge.xEnd, 0, rect.w);
  return clamp(Math.abs(end - start) / Math.max(1, rect.w), 0, 1);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
