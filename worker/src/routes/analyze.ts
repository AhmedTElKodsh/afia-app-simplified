import {
  AnalysisRequestSchema,
  AnalysisResultSchema,
  DEFAULT_BOTTLE_SIZE,
} from "@afia/shared";
import type { Context } from "hono";
import { callGemini } from "../llm/gemini.js";
import { callGrok } from "../llm/grok.js";
import { parseEvidenceResponse } from "../eval/parse-response.js";
import type { Env } from "../env.js";
import { buildGeminiKeyPool, selectGeminiKey } from "../llm/rotation.js";
import { createAnalysisStorage } from "../storage/supabase.js";

const PROMPT_VERSION = "v1";
const DEFAULT_MODEL_ID = "gemini-2.5-flash";
const DEFAULT_GROK_MODEL_ID = "grok-2-vision-1212";

const SYSTEM_TEXT = "You estimate remaining oil in a 1.5L Afia cooking-oil bottle from one front-side image by locating the visible oil-air boundary. Before outputting JSON, first describe your visual observations in a 'Visual Reasoning' section — where you see the meniscus, glare, boundary clarity, and how you mapped it to a measurement. Then provide the final JSON.";
const USER_TEXT = [
  "Estimate the visible oil level for the target Afia 1.5L bottle.",
  "First describe your visual reasoning, then return evidence JSON with readingPossible, meniscusVisible, oilSurfaceYRatio, nearestReferenceMl, qualityFlags, and confidence.",
].join("\n");

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
    return c.json({ error: "LLM analysis failed" }, 502);
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
      promptVersion: PROMPT_VERSION,
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
    return c.json({ error: "Analysis persistence failed" }, 500);
  }

  return c.json({
    ...result,
    analysisId,
  });
}

async function callGeminiWithRetry(env: Env, keyPool: string[], imageBase64: string): Promise<string> {
  const attempts = Math.min(2, Math.max(1, keyPool.length));
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await callGemini({
        apiKey: selectGeminiKey(keyPool, attempt),
        modelId: env.MODEL_ID ?? DEFAULT_MODEL_ID,
        systemText: SYSTEM_TEXT,
        userText: USER_TEXT,
        fewShots: [],
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
  fallbackReason?: "gemini_failed";
};

async function analyzeWithFallback(env: Env, keyPool: string[], imageBase64: string): Promise<ModelAnalysis> {
  try {
    return {
      rawModelText: await callGeminiWithRetry(env, keyPool, imageBase64),
      provider: "gemini",
      modelId: env.MODEL_ID ?? DEFAULT_MODEL_ID,
    };
  } catch (error) {
    console.error(error);
    if (!env.GROK_API_KEY) throw error;

    const modelId = env.GROK_MODEL_ID ?? DEFAULT_GROK_MODEL_ID;
    return {
      rawModelText: await callGrok({
        apiKey: env.GROK_API_KEY,
        modelId,
        systemText: SYSTEM_TEXT,
        userText: USER_TEXT,
        imageBase64,
        targetMimeType: readMimeType(imageBase64),
      }),
      provider: "grok",
      modelId,
      fallbackReason: "gemini_failed",
    };
  }
}

function stripDataUrlPrefix(value: string): string {
  const commaIndex = value.indexOf(",");
  return value.startsWith("data:") && commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
}

function readMimeType(value: string): string {
  const match = /^data:([^;]+);base64,/.exec(value);
  return match?.[1] ?? "image/jpeg";
}
