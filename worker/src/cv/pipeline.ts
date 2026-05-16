import { ensureCv } from "./index.js";
import { preprocess, releasePreprocessed } from "./preprocess.js";
import { detectMeniscus } from "./contour.js";
import { scoreConfidence } from "./confidence.js";
import { validateBottle } from "./validate.js";
import { contourNotFound, implausibleRatio, perspectiveFailed, internalError } from "./errors.js";
import type { PipelineError } from "./errors.js";
import { logStage } from "./logger.js";

export interface PipelineInput {
  imageData: ArrayBuffer;
  bottleSizeMl?: number;
  imageBase64?: string;
  geminiApiKey?: string;
}

export interface PipelineOutput {
  success: boolean;
  fillRatio: number | null;
  category: string | null;
  confidence: number;
  tier: "high" | "medium" | "low";
  errors: PipelineError[];
  diagnostics: {
    contourFound: boolean;
    meniscusY: number | null;
    edgeStrength: number;
    stages: string[];
    missReason?: string;
  };
}

export function ratioToCategory(ratio: number): string {
  if (ratio < 0.125) return "Empty";
  if (ratio < 0.375) return "Quarter";
  if (ratio < 0.625) return "Half";
  if (ratio < 0.875) return "Three Quarter";
  return "Full";
}

export async function runPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const stages: string[] = [];
  const errors: PipelineError[] = [];

  try {
    // Stage 1: Bottle validation
    stages.push("validate");
    const t0 = Date.now();
    const bottleCheck = validateBottle(input.bottleSizeMl ?? 1500);
    logStage("validate", Date.now() - t0, 1, bottleCheck.supported ? "pass" : "unsupported");
    if (!bottleCheck.supported) {
      return {
        success: false,
        fillRatio: null,
        category: null,
        confidence: 0,
        tier: "low",
        errors: [{
          stage: "validate",
          code: "UNSUPPORTED_BOTTLE",
          message: bottleCheck.message ?? "Unsupported bottle size",
          recoverable: false,
        }],
        diagnostics: { contourFound: false, meniscusY: null, edgeStrength: 0, stages },
      };
    }

    // Stage 2: Image preprocessing
    stages.push("preprocess");
    const t1 = Date.now();
    let preprocessed;
    try {
      preprocessed = await preprocess(input.imageData);
      logStage("preprocess", Date.now() - t1, 1, "pass");
    } catch (e) {
      logStage("preprocess", Date.now() - t1, 0, "fail", (e as Error).message);
      console.error("Preprocess error:", e);
      errors.push(perspectiveFailed());
      return errorResult(errors, stages);
    }

    // Stage 3: Contour detection
    stages.push("contour");
    const t2 = Date.now();
    let contourResult;
    try {
      contourResult = await detectMeniscus(preprocessed);
      logStage("contour", Date.now() - t2, Math.min(1, contourResult.edgeStrength / 2000), contourResult.found ? "found" : "not_found");
    } catch (e) {
      logStage("contour", Date.now() - t2, 0, "fail");
      errors.push(internalError(`Contour detection failed: ${(e as Error).message}`));
      releasePreprocessed(preprocessed);
      return errorResult(errors, stages);
    }

    releasePreprocessed(preprocessed);

    if (!contourResult.found) {
      errors.push(contourNotFound());
      return {
        success: false, fillRatio: null, category: null, confidence: 0, tier: "low",
        errors,
        diagnostics: { contourFound: false, meniscusY: null, edgeStrength: 0, stages, missReason: contourResult.missReason || "contour_not_found" },
      };
    }

    if (contourResult.meniscusYRatio === null) {
      errors.push(implausibleRatio(-1));
      return {
        success: false, fillRatio: null, category: null, confidence: 0, tier: "low",
        errors,
        diagnostics: { contourFound: true, meniscusY: contourResult.meniscusY, edgeStrength: contourResult.edgeStrength, stages, missReason: "null_ratio" },
      };
    }
    if (contourResult.meniscusYRatio < -0.5 || contourResult.meniscusYRatio > 1.5) {
      errors.push(implausibleRatio(contourResult.meniscusYRatio));
      return {
        success: false, fillRatio: null, category: null, confidence: 0, tier: "low",
        errors,
        diagnostics: { contourFound: true, meniscusY: contourResult.meniscusY, edgeStrength: contourResult.edgeStrength, stages, missReason: "implausible_ratio" },
      };
    }

    // Stage 4: Confidence scoring
    stages.push("confidence");
    const t3 = Date.now();
    const confidence = scoreConfidence(contourResult);
    logStage("confidence", Date.now() - t3, confidence.score, confidence.tier);

    stages.push("complete");
    console.log(JSON.stringify({ event: "cv_pipeline_complete", stages }));

    return {
      success: true,
      fillRatio: contourResult.meniscusYRatio,
      category: contourResult.meniscusYRatio !== null ? ratioToCategory(contourResult.meniscusYRatio) : null,
      confidence: confidence.score,
      tier: confidence.tier,
      errors,
      diagnostics: {
        contourFound: true,
        meniscusY: contourResult.meniscusY,
        edgeStrength: contourResult.edgeStrength,
        stages,
      },
    };
  } catch (e) {
    errors.push(internalError((e as Error).message));
    return errorResult(errors, stages);
  }
}

function errorResult(errors: PipelineError[], stages: string[]): PipelineOutput {
  return {
    success: false,
    fillRatio: null,
    category: null,
    confidence: 0,
    tier: "low",
    errors,
    diagnostics: {
      contourFound: false,
      meniscusY: null,
      edgeStrength: 0,
      stages,
    },
  };
}
