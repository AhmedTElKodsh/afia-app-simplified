import { describe, expect, it } from "vitest";
import {
  createStage15SignoffReport,
  generateStage15Signoff,
  validateEvalArtifact,
} from "../src/eval/stage15-signoff.js";

function baseArtifact(overrides: Record<string, unknown> = {}) {
  const artifact = {
    summary: {
      manifestCount: 2,
      evaluatedCount: 2,
      exact: { count: 2, pct: 100 },
      close: { count: 2, pct: 100 },
      fusion: {
        sourceCounts: { heuristic: 1, fusion: 1 },
        ignoredReasonCounts: { "onnx:nearZeroEstimate": 1 },
        disagreementPenaltyBuckets: { "0": 1, "0.1-0.25": 1 },
        validSignalCounts: { "1": 1, "2": 1 },
        tierDistribution: { medium: 1, high: 1 },
        onnxHeuristicDeltaMl: { count: 2, avg: 40, max: 75 },
      },
      quality: {
        meanSignedErrorMl: 0,
        meanAbsErrorMl: 0,
        maxAbsErrorMl: 0,
        errorBuckets: { "0-55": 2 },
        groundTruthBands: { mid: { count: 2, exactPct: 100, closePct: 100, meanSignedErrorMl: 0 } },
        highConfidenceWrongCount: 0,
      },
    },
    results: [baseRow("row-a", 500, true), baseRow("row-b", 800, true)],
  };
  return { ...artifact, ...overrides };
}

function baseRow(imageId: string, groundTruthMl: number, pass: boolean) {
  return {
    imageId,
    groundTruthMl,
    cvMl: groundTruthMl,
    absErrorMl: 0,
    exactBucketPass: pass,
    closeBucketPass: pass,
    tier: "high",
    confidenceScore: 0.91,
    fillRatio: groundTruthMl / 1500,
    contourFound: true,
    edgeStrength: 1400,
    stages: ["validate", "preprocess", "contour", "onnx_inference", "confidence", "fusion", "complete"],
    onnxScore: 0.77,
    onnxLoadStatus: "cached",
    fusionConfidence: 0.9,
    fusionTier: "high",
    fusionSource: "fusion",
    fusionRemainingMl: groundTruthMl,
    fusionDisagreementPenalty: 0,
    fusionValidSignalCount: 2,
    fusionFallback: false,
    fusionSignalPresence: { heuristic: true, onnx: true, llm: false },
    fusionIgnoredReasons: {},
    onnxHeuristicDeltaMl: 25,
  };
}

const packageWithoutSharp = {
  dependencies: { hono: "4.6.10" },
  devDependencies: { vitest: "2.1.4" },
};

describe("Stage 1.5 signoff", () => {
  it("fails clearly when the eval artifact is missing", async () => {
    await expect(generateStage15Signoff({ evalPath: "runs/does-not-exist/cv-eval-results.json" }))
      .rejects.toThrow("Missing eval artifact: runs/does-not-exist/cv-eval-results.json. Run: pnpm eval:edge");
  });

  it("rejects malformed summary/results with row-level reasons", () => {
    expect(() => validateEvalArtifact({ summary: { exact: {} }, results: [{ imageId: 42 }] }))
      .toThrow(/summary\.manifestCount: malformed number/);
    expect(() => validateEvalArtifact({ summary: { exact: {} }, results: [{ imageId: 42 }] }))
      .toThrow(/results\[0\]\.groundTruthMl: missing required field/);
    expect(() => validateEvalArtifact({ summary: { exact: {} }, results: [{ imageId: 42 }] }))
      .toThrow(/results\[0\]\.imageId: malformed string/);
  });

  it("records missing fusion fields as a diagnostics no-go instead of silently passing", () => {
    const artifact = baseArtifact();
    delete (artifact.results[0] as any).fusionSource;
    delete (artifact.results[0] as any).fusionValidSignalCount;

    const report = createStage15SignoffReport({ artifact, packageJson: packageWithoutSharp, now: new Date("2026-01-01T00:00:00Z") });

    expect(report.verdict).toBe("no-go");
    expect(report.gates.diagnostics.status).toBe("no-go");
    expect(report.diagnostics.missingFusionFieldRows).toBe(1);
    expect(report.diagnostics.missingFusionFields).toMatchObject({ fusionSource: 1, fusionValidSignalCount: 1 });
    expect(report.diagnostics.anomalies).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 0, imageId: "row-a", field: "fusionSource", reason: "missing fusion diagnostic field" }),
    ]));
  });

  it("counts NaN rows as diagnostic anomalies", () => {
    const artifact = baseArtifact();
    (artifact.results[1] as any).fusionRemainingMl = Number.NaN;

    const report = createStage15SignoffReport({ artifact, packageJson: packageWithoutSharp });

    expect(report.gates.diagnostics.status).toBe("no-go");
    expect(report.diagnostics.nonFiniteNumberRows).toBe(1);
    expect(report.diagnostics.anomalies).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 1, field: "fusionRemainingMl", reason: "non-finite numeric value" }),
    ]));
  });

  it("passes Worker runtime compatibility when sharp is absent", () => {
    const report = createStage15SignoffReport({ artifact: baseArtifact(), packageJson: packageWithoutSharp });

    expect(report.gates.runtimeCompatibility.status).toBe("pass");
    expect(report.runtimeCompatibility.sharpDependencyPresent).toBe(false);
  });

  it("flags Worker runtime compatibility when sharp is declared", () => {
    const report = createStage15SignoffReport({
      artifact: baseArtifact(),
      packageJson: { dependencies: { sharp: "^0.33.0" } },
    });

    expect(report.gates.runtimeCompatibility.status).toBe("no-go");
    expect(report.runtimeCompatibility.sharpDependencyPresent).toBe(true);
  });

  it("keeps report generation successful while accuracy is a business no-go", () => {
    const artifact = baseArtifact({
      summary: {
        ...baseArtifact().summary,
        exact: { count: 1, pct: 50 },
        close: { count: 1, pct: 50 },
      },
    });

    const report = createStage15SignoffReport({ artifact, packageJson: packageWithoutSharp });

    expect(report.verdict).toBe("no-go");
    expect(report.gates.accuracy.status).toBe("no-go");
    expect(report.gates.diagnostics.status).toBe("pass");
    expect(report.gates.runtimeCompatibility.status).toBe("pass");
  });

  it("surfaces high-confidence wrong answers as a diagnostic no-go", () => {
    const artifact = baseArtifact();
    artifact.summary.quality.highConfidenceWrongCount = 1;

    const report = createStage15SignoffReport({ artifact, packageJson: packageWithoutSharp });

    expect(report.gates.diagnostics.status).toBe("no-go");
    expect(report.gates.diagnostics.reasons).toContain("1 high-confidence wrong row(s) in eval artifact");
    expect(report.qualityDiagnostics).toMatchObject({ highConfidenceWrongCount: 1 });
  });
});
