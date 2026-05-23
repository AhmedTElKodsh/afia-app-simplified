import { describe, expect, it } from "vitest";
import { buildOverlayValidationPrompt, parseOverlayValidationResponse } from "../src/llm/overlay-validation.js";

const candidate = {
  id: "line-0",
  y: 420,
  yRatioInBottle: 0.5,
  score: 0.82,
  edgeStrength: 1500,
  horizontalCoverage: 0.8,
  source: "ransac_cluster" as const,
  angleDeg: 0,
  inlierCount: 4,
  reason: "edge_strength+fillable_band+coverage+ransac_cluster",
};

describe("overlay validation prompt", () => {
  it("constrains the LLM to validate local candidates instead of measuring ml", () => {
    const prompt = buildOverlayValidationPrompt({
      imageId: "sample.jpg",
      bottleSizeMl: 1500,
      overlaySvgPath: "runs/overlays/sample.svg",
      candidates: [candidate],
    });

    expect(prompt).toContain("Validate the local CV overlay only");
    expect(prompt).toContain("Do not estimate milliliters");
    expect(prompt).toContain("\"id\":\"line-0\"");
  });

  it("rejects responses that select a candidate the local pipeline did not propose", () => {
    expect(() => parseOverlayValidationResponse(JSON.stringify({
      schemaVersion: "afia_overlay_validation_v1",
      acceptedCandidateId: "line-99",
      candidateAccepted: true,
      visibleIssues: [],
      confidence: 0.9,
      explanation: "looks right",
    }), ["line-0"])).toThrow(/unknown candidate/);
  });

  it("parses a valid overlay validation response", () => {
    expect(parseOverlayValidationResponse(JSON.stringify({
      schemaVersion: "afia_overlay_validation_v1",
      acceptedCandidateId: "line-0",
      candidateAccepted: true,
      visibleIssues: ["mild_glare"],
      confidence: 0.72,
      explanation: "candidate aligns with the visible boundary",
    }), ["line-0"])).toMatchObject({
      acceptedCandidateId: "line-0",
      candidateAccepted: true,
      visibleIssues: ["mild_glare"],
      confidence: 0.72,
    });
  });
});
