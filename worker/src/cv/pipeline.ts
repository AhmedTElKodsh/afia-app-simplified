import { ensureCv } from "./index.js";
import { preprocess, releasePreprocessed } from "./preprocess.js";
import { detectMeniscus } from "./contour.js";
import { scoreConfidence } from "./confidence.js";
import { validateBottle } from "./validate.js";
import { contourNotFound, implausibleRatio, perspectiveFailed, internalError } from "./errors.js";
import type { PipelineError } from "./errors.js";
import { logStage } from "./logger.js";
import { isModelLoaded, loadOnnxModel, runOnnxInference } from "../onnx/loader.js";
import { MODEL_PATHS } from "../onnx/models.js";
import { FusionScorer } from "../scoring/fusion-scorer.js";
import type { Scorer, ScorerResult } from "../scoring/interface.js";
import type { LiquidLineCandidate } from "./candidate-lines.js";
import { contourFromLabeledMask, type LabeledMaskEvidence } from "./labeled-mask.js";
import * as ort from "onnxruntime-web";

export interface PipelineInput {
  imageData: ArrayBuffer;
  bottleSizeMl?: number;
  imageBase64?: string;
  geminiApiKey?: string;
  llmRemainingMl?: number;
  llmFillRatio?: number;
  llmConfidence?: number;
  llmScore?: number;
  labeledMask?: LabeledMaskEvidence;
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
    lineCandidates?: LiquidLineCandidate[];
    bottleRect?: { x: number; y: number; w: number; h: number };
    selectedLineSource?: "candidate" | "fusion" | "labeled_mask";
    measurementState?: "measured" | "needs_review" | "failed";
    edgeStrength: number;
    stages: string[];
    missReason?: string;
    onnxScore?: number;
    onnxLoadStatus?: string;
    heuristicConfidence?: number;
    fusion?: {
      source: string;
      confidence: number;
      score: number;
      remainingMl: number;
      features: Record<string, number>;
    };
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
  let onnxScore: number | undefined;
  let onnxLoadStatus = "not_attempted";

  try {
    // Stage 0: ONNX model loading (lazy)
    if (!isModelLoaded()) {
      try {
        const tModel = Date.now();
        await loadOnnxModel(MODEL_PATHS.regression);
        onnxLoadStatus = `loaded (${Date.now() - tModel}ms)`;
        logStage("onnx_load", Date.now() - tModel, 1, "pass");
      } catch (e) {
        onnxLoadStatus = `fail: ${(e as Error).message}`;
        logStage("onnx_load", 0, 0, "fail", (e as Error).message);
      }
    } else {
      onnxLoadStatus = "cached";
    }

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
        diagnostics: { contourFound: false, meniscusY: null, lineCandidates: [], edgeStrength: 0, stages, onnxLoadStatus },
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
      return errorResult(errors, stages, { onnxLoadStatus });
    }

    // Stage 3: labeled mask/keypoint evidence or contour detection
    stages.push(input.labeledMask ? "labeled_mask" : "contour");
    const t2 = Date.now();
    let contourResult;
    try {
      contourResult = input.labeledMask
        ? contourFromLabeledMask(input.labeledMask, preprocessed.width, preprocessed.height, input.bottleSizeMl ?? 1500)
        : await detectMeniscus(preprocessed, input.bottleSizeMl ?? 1500);
      logStage(input.labeledMask ? "labeled_mask" : "contour", Date.now() - t2, Math.min(1, contourResult.edgeStrength / 2000), contourResult.found ? "found" : "not_found");
    } catch (e) {
      logStage("contour", Date.now() - t2, 0, "fail");
      errors.push(internalError(`Contour detection failed: ${(e as Error).message}`));
      releasePreprocessed(preprocessed);
      return errorResult(errors, stages, { onnxLoadStatus });
    }

    releasePreprocessed(preprocessed);

    if (!contourResult.found) {
      errors.push(contourNotFound());
      return {
        success: false, fillRatio: null, category: null, confidence: 0, tier: "low",
        errors,
        diagnostics: {
          contourFound: false,
          meniscusY: null,
          lineCandidates: contourResult.lineCandidates ?? [],
          bottleRect: contourResult.bottleRect,
          selectedLineSource: contourResult.selectedLineSource,
          measurementState: contourResult.measurementState ?? "failed",
          edgeStrength: 0,
          stages,
          missReason: contourResult.missReason || "contour_not_found",
          onnxLoadStatus,
        },
      };
    }

    if (contourResult.meniscusYRatio === null) {
      errors.push(implausibleRatio(-1));
      return {
        success: false, fillRatio: null, category: null, confidence: 0, tier: "low",
        errors,
        diagnostics: {
          contourFound: true,
          meniscusY: contourResult.meniscusY,
          lineCandidates: contourResult.lineCandidates ?? [],
          bottleRect: contourResult.bottleRect,
          selectedLineSource: contourResult.selectedLineSource,
          measurementState: contourResult.measurementState ?? "failed",
          edgeStrength: contourResult.edgeStrength,
          stages,
          missReason: "null_ratio",
          onnxLoadStatus,
        },
      };
    }
    if (contourResult.meniscusYRatio < -0.5 || contourResult.meniscusYRatio > 1.5) {
      errors.push(implausibleRatio(contourResult.meniscusYRatio));
      return {
        success: false, fillRatio: null, category: null, confidence: 0, tier: "low",
        errors,
        diagnostics: {
          contourFound: true,
          meniscusY: contourResult.meniscusY,
          lineCandidates: contourResult.lineCandidates ?? [],
          bottleRect: contourResult.bottleRect,
          selectedLineSource: contourResult.selectedLineSource,
          measurementState: contourResult.measurementState ?? "failed",
          edgeStrength: contourResult.edgeStrength,
          stages,
          missReason: "implausible_ratio",
          onnxLoadStatus,
        },
      };
    }

    // Stage 3.5: ONNX Inference (if model loaded)
    if (isModelLoaded()) {
      stages.push("onnx_inference");
      const tOnnx = Date.now();
      try {
        // Regression model expects four normalized float features.
        const inputData: Record<string, ort.Tensor> = {
          "input": new ort.Tensor("float32", new Float32Array([
            contourResult.edgeStrength / 2000,
            contourResult.contourCount / 100,
            contourResult.meniscusYRatio,
            1,
          ]), [1, 4])
        };
        const results = await runOnnxInference(inputData);
        const output = results["output"];
        if (output) {
          const rawOnnxScore = (output.data as Float32Array)[0];
          onnxScore = Math.max(0, Math.min(1, rawOnnxScore));
          logStage("onnx_inference", Date.now() - tOnnx, onnxScore, "pass");
        }
      } catch (e) {
        logStage("onnx_inference", Date.now() - tOnnx, 0, "fail", (e as Error).message);
      }
    }

    // Stage 4: Conservative multi-signal fusion
    stages.push("confidence");
    stages.push("fusion");
    const t3 = Date.now();
    const heuristicConfidence = scoreConfidence(contourResult);
    const bottleSizeMl = input.bottleSizeMl ?? 1500;
    const heuristicRemainingMl = contourResult.meniscusYRatio * bottleSizeMl;
    const localSource = contourResult.selectedLineSource === "labeled_mask" ? "labeled_mask" : "heuristic";

    const scorers: Scorer[] = [staticScorer(localSource, {
      remainingMl: heuristicRemainingMl,
      confidence: heuristicConfidence.score,
      source: localSource,
      features: {
        contourFillRatio: contourResult.meniscusYRatio,
        contourEdgeStrength: contourResult.edgeStrength,
        contourCount: contourResult.contourCount,
      },
      score: heuristicConfidence.score,
    })];

    if (onnxScore !== undefined) {
      scorers.push(staticScorer("onnx", {
        remainingMl: onnxScore * bottleSizeMl,
        confidence: onnxScore,
        source: "onnx",
        features: { onnxScore },
        score: onnxScore,
      }));
    }

    const llmSignal = normalizeLlmSignal(input, bottleSizeMl);
    if (llmSignal) scorers.push(staticScorer("llm", llmSignal));

    const fused = await new FusionScorer(scorers, {
      maxReasonableRemainingMl: bottleSizeMl,
      weakOnnxHeuristicMl: Math.max(40, bottleSizeMl * 0.08),
      disagreementMl: Math.max(50, bottleSizeMl * 0.1),
    }).score(input.imageData);
    const fusedFillRatio = Math.max(0, Math.min(1, fused.remainingMl / bottleSizeMl));
    const tier = tierFromScore(fused.confidence);
    logStage("confidence", Date.now() - t3, heuristicConfidence.score, heuristicConfidence.tier);
    logStage("fusion", Date.now() - t3, fused.confidence, tier);

    stages.push("complete");
    console.log(JSON.stringify({ event: "cv_pipeline_complete", stages }));

    return {
      success: true,
      fillRatio: fusedFillRatio,
      category: ratioToCategory(fusedFillRatio),
      confidence: fused.confidence,
      tier,
      errors,
      diagnostics: {
        contourFound: true,
        meniscusY: contourResult.meniscusY,
        lineCandidates: contourResult.lineCandidates ?? [],
        bottleRect: contourResult.bottleRect,
        selectedLineSource: contourResult.selectedLineSource,
        measurementState: contourResult.measurementState ?? "measured",
        edgeStrength: contourResult.edgeStrength,
        stages,
        onnxScore,
        onnxLoadStatus,
        heuristicConfidence: heuristicConfidence.score,
        fusion: fusionDiagnostics(fused),
      },
    };
  } catch (e) {
    errors.push(internalError((e as Error).message));
    return errorResult(errors, stages, { onnxLoadStatus });
  }
}

function errorResult(errors: PipelineError[], stages: string[], diagExtras: Partial<PipelineOutput["diagnostics"]> = {}): PipelineOutput {
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
      lineCandidates: [],
      edgeStrength: 0,
      stages,
      ...diagExtras,
    },
  };
}

function staticScorer(name: string, result: ScorerResult): Scorer {
  return {
    name,
    async score() {
      return result;
    },
  };
}

function normalizeLlmSignal(input: PipelineInput, bottleSizeMl: number): ScorerResult | undefined {
  const confidence = input.llmConfidence;
  const score = input.llmScore ?? confidence;
  const remainingMl = input.llmRemainingMl ?? (input.llmFillRatio !== undefined ? input.llmFillRatio * bottleSizeMl : undefined);
  if (remainingMl === undefined && confidence === undefined && score === undefined) return undefined;

  return {
    remainingMl: Number(remainingMl),
    confidence: Number(confidence),
    source: "llm",
    features: { llmSignalProvided: 1 },
    score: Number(score),
  };
}

function fusionDiagnostics(result: ScorerResult): NonNullable<PipelineOutput["diagnostics"]["fusion"]> {
  return {
    source: String(result.source),
    confidence: result.confidence,
    score: result.score,
    remainingMl: result.remainingMl,
    features: result.features,
  };
}

function tierFromScore(score: number): "high" | "medium" | "low" {
  if (score >= CONFIDENCE_TIER_HIGH) return "high";
  if (score >= CONFIDENCE_TIER_MEDIUM) return "medium";
  return "low";
}

const CONFIDENCE_TIER_HIGH = 0.7;
const CONFIDENCE_TIER_MEDIUM = 0.3;
