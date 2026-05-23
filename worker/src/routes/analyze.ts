import {
  AnalysisRequestSchema,
  AnalysisResultSchema,
  DEFAULT_BOTTLE_SIZE,
} from "@afia/shared";
import type { Context } from "hono";
import { callGemini } from "../llm/gemini.js";
import { callGrok } from "../llm/grok.js";
import { callOpenRouter, isOpenRouterVisionModel } from "../llm/openrouter.js";
import { parseEvidenceResponse } from "../eval/parse-response.js";
import { loadPrompt } from "../prompt/load.js";
import type { LoadedPrompt } from "../prompt/load.js";
import type { Env } from "../env.js";
import { buildGeminiKeyPool, buildGrokKeyPool, buildOpenRouterKeyPool, selectKey } from "../llm/rotation.js";
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

  const providerKeyCount = buildGeminiKeyPool(c.env).length +
    (readOpenRouterModelIds(c.env).length > 0 ? buildOpenRouterKeyPool(c.env).length : 0) +
    buildGrokKeyPool(c.env).length;
  if (providerKeyCount === 0) {
    return c.json({ error: "No LLM vision provider key is configured" }, 500);
  }

  let analysis: ModelAnalysis;
  try {
    analysis = await analyzeWithFallback(c.env, body.imageBase64);
  } catch (error) {
    logAnalysisError("LLM analysis failed", error);
    return c.json({ error: "LLM analysis failed", detail: publicErrorDetail(error) }, 502);
  }

  let result: ReturnType<typeof AnalysisResultSchema.parse>;
  try {
    const parsed = parseEvidenceResponse(analysis.rawModelText);
    result = AnalysisResultSchema.parse({
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
  } catch (error) {
    logAnalysisError("LLM response parsing failed", error);
    return c.json({ error: "LLM analysis failed", detail: publicErrorDetail(error) }, 502);
  }

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
    logAnalysisError("Analysis persistence failed", error);
    return c.json({
      error: "Analysis persistence failed",
      detail: { code: "PERSISTENCE_FAILED", message: "Could not save analysis result" },
    }, 500);
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
        apiKey: selectKey(keyPool, attempt),
        modelId: env.MODEL_ID ?? DEFAULT_MODEL_ID,
        systemText: prompt.systemText,
        userText: prompt.userText,
        fewShots: prompt.fewShots,
        imageBase64: stripDataUrlPrefix(imageBase64),
        targetMimeType: readMimeType(imageBase64),
        maxAttempts: 1,
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
  provider: "gemini" | "openrouter" | "grok";
  modelId: string;
  promptVersion: string;
  promptHash: string;
  fewshotHash: string;
  fallbackReason?: "gemini_failed" | "gemini_low_confidence" | "gemini_unconfigured" | "openrouter_failed" | "openrouter_low_confidence";
};

async function analyzeWithFallback(env: Env, imageBase64: string): Promise<ModelAnalysis> {
  const prompt = await loadPrompt(PROMPT_VERSION);
  const geminiKeys = buildGeminiKeyPool(env);
  const openRouterKeys = buildOpenRouterKeyPool(env);
  const grokKeys = buildGrokKeyPool(env);
  let lastError: unknown;
  let fallbackReason: ModelAnalysis["fallbackReason"] = geminiKeys.length > 0 ? undefined : "gemini_unconfigured";

  if (geminiKeys.length > 0) {
    try {
      const geminiRaw = await callGeminiWithRetry(env, geminiKeys, imageBase64, prompt);
      const geminiParsed = parseEvidenceResponse(geminiRaw);
      if (geminiParsed.confidence >= readGrokFallbackConfidence(env)) {
        return {
          rawModelText: geminiRaw,
          provider: "gemini",
          modelId: env.MODEL_ID ?? DEFAULT_MODEL_ID,
          promptVersion: prompt.promptVersion,
          promptHash: prompt.promptHash,
          fewshotHash: prompt.fewshotHash,
        };
      }
      lastError = new Error(`Gemini confidence ${geminiParsed.confidence} below fallback threshold`);
      fallbackReason = "gemini_low_confidence";
    } catch (error) {
      logAnalysisError("Gemini provider failed", error);
      lastError = error;
      fallbackReason = "gemini_failed";
    }
  }

  if (openRouterKeys.length > 0) {
    try {
      const openRouterAnalysis = await callOpenRouterWithRetry(env, openRouterKeys, imageBase64, prompt);
      const openRouterParsed = parseEvidenceResponse(openRouterAnalysis.rawModelText);
      if (openRouterParsed.confidence >= readGrokFallbackConfidence(env) || grokKeys.length === 0) {
        return { ...openRouterAnalysis, fallbackReason };
      }
      lastError = new Error(`OpenRouter confidence ${openRouterParsed.confidence} below fallback threshold`);
      fallbackReason = "openrouter_low_confidence";
    } catch (error) {
      logAnalysisError("OpenRouter provider failed", error);
      lastError = error;
      fallbackReason = "openrouter_failed";
    }
  }

  if (grokKeys.length > 0) {
    const grokAnalysis = await callGrokWithRetry(env, grokKeys, imageBase64, prompt);
    return {
      ...grokAnalysis,
      fallbackReason,
    };
  }

  throw lastError instanceof Error ? lastError : new Error("No configured LLM vision provider could analyze the image");
}

async function callOpenRouterWithRetry(env: Env, keyPool: string[], imageBase64: string, prompt: LoadedPrompt): Promise<ModelAnalysis> {
  const modelIds = readOpenRouterModelIds(env);
  if (modelIds.length === 0) {
    throw new Error("No OpenRouter vision-capable model is configured");
  }

  let lastError: unknown;
  for (const modelId of modelIds) {
    for (let attempt = 0; attempt < keyPool.length; attempt += 1) {
      try {
        return {
          rawModelText: await callOpenRouter({
            apiKey: selectKey(keyPool, attempt),
            modelId,
            systemText: prompt.systemText,
            userText: prompt.userText,
            imageBase64,
            targetMimeType: readMimeType(imageBase64),
          }),
          provider: "openrouter",
          modelId,
          promptVersion: prompt.promptVersion,
          promptHash: prompt.promptHash,
          fewshotHash: prompt.fewshotHash,
        };
      } catch (error) {
        lastError = error;
        if (attempt < keyPool.length - 1) await sleep(1000);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("OpenRouter analysis failed");
}

async function callGrokWithRetry(env: Env, keyPool: string[], imageBase64: string, prompt: LoadedPrompt): Promise<ModelAnalysis> {
  const modelId = env.GROK_MODEL_ID ?? DEFAULT_GROK_MODEL_ID;
  let lastError: unknown;

  for (let attempt = 0; attempt < keyPool.length; attempt += 1) {
    try {
      return {
        rawModelText: await callGrok({
          apiKey: selectKey(keyPool, attempt),
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
      };
    } catch (error) {
      lastError = error;
      if (attempt < keyPool.length - 1) await sleep(1000);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Grok analysis failed");
}

function readOpenRouterModelIds(env: Env): string[] {
  const configured = [
    ...splitCsv(env.OPENROUTER_MODEL_IDS),
    env.OPENROUTER_MODEL_ID,
  ];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const modelId of configured) {
    const trimmed = modelId?.trim();
    if (!trimmed || seen.has(trimmed) || !isOpenRouterVisionModel(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function splitCsv(value: string | undefined): string[] {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
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

function logAnalysisError(message: string, error: unknown): void {
  console.error(message, publicErrorDetail(error));
}

function redactKeyLikeText(value: string): string {
  return value
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted-google-key]")
    .replace(/sk-or-v1-[0-9A-Za-z_-]{20,}/g, "[redacted-openrouter-key]")
    .replace(/"user_id"\s*:\s*"[^"]+"/g, "\"user_id\":\"[redacted-openrouter-user]\"")
    .replace(/xai-[0-9A-Za-z_-]{20,}/g, "[redacted-xai-key]")
    .replace(/gsk_[0-9A-Za-z_-]{20,}/g, "[redacted-groq-key]")
    .replace(/hf_[0-9A-Za-z_-]{20,}/g, "[redacted-huggingface-key]")
    .slice(0, 500);
}
