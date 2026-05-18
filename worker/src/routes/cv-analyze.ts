import type { Context } from "hono";
import type { Env } from "../env.js";
import { runPipeline } from "../cv/pipeline.js";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const VALID_MIME_PREFIXES = ["data:image/jpeg", "data:image/png"];

export async function cvAnalyzeRoute(c: Context<{ Bindings: Env }>) {
  try {
    const body = await c.req.json().catch(() => null) as any;
    if (!body?.imageBase64) {
      return c.json({ error: "imageBase64 is required" }, 400);
    }

    // Validate MIME type
    const mimePrefix = body.imageBase64.split(",")[0] ?? "";
    const hasValidMime = VALID_MIME_PREFIXES.some((p) => mimePrefix.startsWith(p));
    if (!hasValidMime) {
      return c.json({ error: "Unsupported image format. Use JPEG or PNG." }, 400);
    }

    // Check file size before decoding
    const base64Data = body.imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const decodedSize = Math.ceil(base64Data.length * 0.75);
    if (decodedSize > MAX_IMAGE_SIZE_BYTES) {
      return c.json({ error: `Image too large. Maximum size is ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB.` }, 413);
    }

    const buffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0)).buffer;

    const bottleSizeMl = body.bottleSizeMl === undefined ? 1500 : Number(body.bottleSizeMl);
    if (!Number.isFinite(bottleSizeMl) || bottleSizeMl <= 0) {
      return c.json({ error: "Invalid bottleSizeMl" }, 400);
    }
    if (bottleSizeMl !== 1500) {
      return c.json({ error: "Unsupported bottleSizeMl. Stage 1 CV supports 1500ml only." }, 422);
    }

    const result = await runPipeline({
      imageData: buffer,
      bottleSizeMl,
      imageBase64: body.imageBase64,
      geminiApiKey: c.env.GEMINI_API_KEY,
      llmRemainingMl: body.llmRemainingMl,
      llmFillRatio: body.llmFillRatio,
      llmConfidence: body.llmConfidence,
      llmScore: body.llmScore,
    });

    return c.json({
      remainingMl: result.fillRatio !== null ? Math.round(result.fillRatio * bottleSizeMl) : null,
      category: result.category,
      confidence: result.confidence,
      tier: result.tier,
      diagnostics: result.diagnostics,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (e) {
    console.error("CV analyze failed:", e);
    return c.json({ error: "CV analysis failed" }, 500);
  }
}
