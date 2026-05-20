import {
  AnalysisRequestSchema,
  AnalysisResultSchema,
  DEFAULT_BOTTLE_SIZE,
} from "@afia/shared";
import type { Context } from "hono";
import { callGemini } from "../llm/gemini.js";
import { callGrok } from "../llm/grok.js";
import { parseEvidenceResponse } from "../eval/parse-response.js";
import { loadPrompt } from "../prompt/load.js";
import type { LoadedPrompt } from "../prompt/load.js";
import type { Env } from "../env.js";
import { buildGeminiKeyPool, selectGeminiKey } from "../llm/rotation.js";
import { createAnalysisStorage } from "../storage/supabase.js";

const PROMPT_VERSION = "v1";
const DEFAULT_MODEL_ID = "gemini-2.5-flash";
const DEFAULT_GROK_MODEL_ID = "grok-2-vision-1212";
const DEFAULT_GROK_FALLBACK_CONFIDENCE = 0.5;

export async function analyzeRoute(c: Context<{ Bindings: Env }>) {
  let body: ReturnType<typeof AnalysisRequestSchema.parse>;
  try {
    body = AnalysisRequestSchema.parse(await c.req.json().catch(() => null));
  } catch {
    return c.json({ error: "Invalid analyze request" }, 400);
  }

  if (body.bottleSize !== DEFAULT_BOTTLE_SIZE) {
    return c.json({ error: "Unsupported bottle size", supportedBottleSize: DEFAULT_BOTTLE_SIZE }, 422);
  }

  const keyPool = buildGeminiKeyPool(c.env);
  if (keyPool.length === 0) {
    return c.json({ error: "Gemini API key is not configured" }, 500);
  }

  let analysis: ModelAnalysis;
  try {
    analysis = await analyzeWithFallback(c.env, keyPool, body.imageBase64);
  } catch (error) {
    console.error(error);
    return c.json({ error: "LLM analysis failed", detail: publicErrorDetail(error) }, 502);
  }

  const parsed = parseEvidenceResponse(analysis.rawModelText);
  const result = AnalysisResultSchema.parse({
    remainingMl: parsed.remainingMl,
    consumedMl: parsed.consumedMl,
    redLineYRatio: parsed.redLineYRatio,
    confidence: parsed.confidence,
    warnings: parsed.qualityFlags,
    provider: analysis.provider,
    rawMetadata: {
      modelId: analysis.modelId,
      promptVersion: analysis.promptVersion,
      promptHash: analysis.promptHash,
      fewshotHash: analysis.fewshotHash,
      rawModelText: analysis.rawModelText,
      fallbackReason: analysis.fallbackReason,
    },
  });

  let analysisId: string | undefined;
  try {
    const saved = await createAnalysisStorage(c.env).saveAnalysis({
      id: crypto.randomUUID(),
      bottleSize: body.bottleSize,
      imageBase64: body.imageBase64,
      result,
    });
    analysisId = saved.id;
  } catch (error) {
    console.error(error);
    return c.json({ error: "Analysis persistence failed", detail: publicErrorDetail(error) }, 500);
  }

  return c.json({
    ...result,
    analysisId,
  });
}

async function callGeminiWithRetry(env: Env, keyPool: string[], imageBase64: string, prompt: LoadedPrompt): Promise<string> {
  const attempts = Math.max(1, keyPool.length);
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await callGemini({
        apiKey: selectGeminiKey(keyPool, attempt),
        modelId: env.MODEL_ID ?? DEFAULT_MODEL_ID,
        systemText: prompt.systemText,
        userText: prompt.userText,
        fewShots: prompt.fewShots,
        imageBase64: stripDataUrlPrefix(imageBase64),
        targetMimeType: readMimeType(imageBase64),
      });
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await sleep(1000);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini analysis failed");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ModelAnalysis = {
  rawModelText: string;
  provider: "gemini" | "grok";
  modelId: string;
  promptVersion: string;
  promptHash: string;
  fewshotHash: string;
  fallbackReason?: "gemini_failed" | "gemini_low_confidence";
};

async function analyzeWithFallback(env: Env, keyPool: string[], imageBase64: string): Promise<ModelAnalysis> {
  const prompt = await loadPrompt(PROMPT_VERSION);

  try {
    const geminiRaw = await callGeminiWithRetry(env, keyPool, imageBase64, prompt);
    const geminiParsed = parseEvidenceResponse(geminiRaw);
    if (env.GROK_API_KEY && geminiParsed.confidence < readGrokFallbackConfidence(env)) {
      const modelId = env.GROK_MODEL_ID ?? DEFAULT_GROK_MODEL_ID;
      return {
        rawModelText: await callGrok({
          apiKey: env.GROK_API_KEY,
          modelId,
          systemText: prompt.systemText,
          userText: prompt.userText,
          imageBase64,
          targetMimeType: readMimeType(imageBase64),
        }),
        provider: "grok",
        modelId,
        promptVersion: prompt.promptVersion,
        promptHash: prompt.promptHash,
        fewshotHash: prompt.fewshotHash,
        fallbackReason: "gemini_low_confidence",
      };
    }

    return {
      rawModelText: geminiRaw,
      provider: "gemini",
      modelId: env.MODEL_ID ?? DEFAULT_MODEL_ID,
      promptVersion: prompt.promptVersion,
      promptHash: prompt.promptHash,
      fewshotHash: prompt.fewshotHash,
    };
  } catch (error) {
    console.error(error);
    if (!env.GROK_API_KEY) throw error;

    const modelId = env.GROK_MODEL_ID ?? DEFAULT_GROK_MODEL_ID;
    return {
      rawModelText: await callGrok({
        apiKey: env.GROK_API_KEY,
        modelId,
        systemText: prompt.systemText,
        userText: prompt.userText,
        imageBase64,
        targetMimeType: readMimeType(imageBase64),
      }),
      provider: "grok",
      modelId,
      promptVersion: prompt.promptVersion,
      promptHash: prompt.promptHash,
      fewshotHash: prompt.fewshotHash,
      fallbackReason: "gemini_failed",
    };
  }
}

function readGrokFallbackConfidence(env: Env): number {
  const configured = Number(env.GROK_FALLBACK_CONFIDENCE);
  return Number.isFinite(configured) && configured >= 0 && configured <= 1
    ? configured
    : DEFAULT_GROK_FALLBACK_CONFIDENCE;
}

function stripDataUrlPrefix(value: string): string {
  const commaIndex = value.indexOf(",");
  return value.startsWith("data:") && commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
}

function readMimeType(value: string): string {
  const match = /^data:([^;]+);base64,/.exec(value);
  return match?.[1] ?? "image/jpeg";
}

function publicErrorDetail(error: unknown): { status?: number; message: string } {
  if (!error || typeof error !== "object") {
    return { message: "Unknown provider error" };
  }

  const maybeError = error as { status?: number; message?: string };
  return {
    status: maybeError.status,
    message: redactKeyLikeText(maybeError.message ?? "Provider request failed"),
  };
}

function redactKeyLikeText(value: string): string {
  return value
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted-google-key]")
    .replace(/xai-[0-9A-Za-z_-]{20,}/g, "[redacted-xai-key]")
    .slice(0, 500);
}
