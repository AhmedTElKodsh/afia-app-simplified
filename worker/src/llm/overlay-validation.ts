import type { LiquidLineCandidate } from "../cv/candidate-lines.js";

export interface OverlayValidationInput {
  imageId: string;
  bottleSizeMl: 1500;
  overlaySvgPath?: string;
  candidates: LiquidLineCandidate[];
}

export interface OverlayValidationResult {
  schemaVersion: "afia_overlay_validation_v1";
  acceptedCandidateId: string | null;
  candidateAccepted: boolean;
  visibleIssues: string[];
  confidence: number;
  explanation: string;
}

export function buildOverlayValidationPrompt(input: OverlayValidationInput): string {
  const candidateRows = input.candidates.map((candidate) => ({
    id: candidate.id,
    y: candidate.y,
    yRatioInBottle: candidate.yRatioInBottle,
    score: candidate.score,
    source: candidate.source,
    reason: candidate.reason,
  }));
  return [
    "Validate the local CV overlay only. Do not estimate milliliters and do not invent a new liquid line.",
    "Choose one candidate id if the red/yellow/green overlay line matches the visible liquid boundary.",
    "Return JSON only with schemaVersion, acceptedCandidateId, candidateAccepted, visibleIssues, confidence, explanation.",
    `imageId: ${input.imageId}`,
    `bottleSizeMl: ${input.bottleSizeMl}`,
    `overlaySvgPath: ${input.overlaySvgPath ?? "not_saved"}`,
    `candidates: ${JSON.stringify(candidateRows)}`,
  ].join("\n");
}

export function parseOverlayValidationResponse(raw: string, candidateIds: readonly string[]): OverlayValidationResult {
  const parsed = JSON.parse(extractJsonObject(raw)) as Partial<OverlayValidationResult>;
  if (parsed.schemaVersion !== "afia_overlay_validation_v1") {
    throw new Error("overlay validation schemaVersion mismatch");
  }
  const acceptedCandidateId = parsed.acceptedCandidateId ?? null;
  if (acceptedCandidateId !== null && !candidateIds.includes(acceptedCandidateId)) {
    throw new Error(`overlay validation selected unknown candidate: ${acceptedCandidateId}`);
  }
  return {
    schemaVersion: "afia_overlay_validation_v1",
    acceptedCandidateId,
    candidateAccepted: Boolean(parsed.candidateAccepted && acceptedCandidateId),
    visibleIssues: Array.isArray(parsed.visibleIssues) ? parsed.visibleIssues.filter((item): item is string => typeof item === "string") : [],
    confidence: clampNumber(parsed.confidence, 0, 1),
    explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
  };
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  throw new Error("overlay validation response did not contain JSON");
}

function clampNumber(value: unknown, min: number, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(min, Math.min(max, n));
}
