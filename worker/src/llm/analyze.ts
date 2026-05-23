import { readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { callGemini } from "./gemini.js";
import { callOpenRouter, isOpenRouterVisionModel } from "./openrouter.js";
import { buildGeminiKeyPool, buildOpenRouterKeyPool, selectGeminiKey, selectKey } from "./rotation.js";
import { loadPrompt } from "../prompt/load.js";
import { parseEvidenceResponse } from "../eval/parse-response.js";
import type { Env } from "../env.js";

// Skip fileURLToPath in Workers environment
let repoRoot: string;
if (typeof process !== "undefined" && process.env) {
  try {
    const { fileURLToPath } = await import("node:url");
    repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  } catch {
    repoRoot = ".";
  }
} else {
  repoRoot = ".";
}

function mimeType(path: string) {
  const ext = extname(path).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

async function readRepoFile(path: string): Promise<Buffer> {
  const directPath = resolve(repoRoot, path);
  try {
    return await readFile(directPath);
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }

  if (path.startsWith("oil-bottle-frames/")) {
    const nestedPath = resolve(repoRoot, "oil-bottle-frames", path);
    try {
      return await readFile(nestedPath);
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
  }

  return await readFile(directPath);
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

function isRetryableKeyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { status?: number; message?: string };
  if (maybeError.status === 403) return true; // leaked/revoked key — try next
  return maybeError.status === 429 ||
    maybeError.status === 503 ||
    /quota exceeded|too many requests|rate limit|high demand|unavailable/i.test(maybeError.message ?? "");
}

export async function analyzeFixture(imagePath: string, env: Env, promptVersion = "v1") {
  const prompt = await loadPrompt(promptVersion);
  const buf = await readRepoFile(imagePath);
  const imageBase64 = buf.toString("base64");
  const referenceImages = await Promise.all(prompt.fewShots.map(async (shot) => ({
    label: `${shot.expected.nearestReferenceMl}ml reference`,
    mimeType: mimeType(shot.imagePath),
    data: (await readRepoFile(shot.imagePath)).toString("base64"),
  })));

  let lastError: unknown;

  // PRIORITY 1: OpenRouter eval lane, using the same key pool and explicit vision model allowlist as the Worker route.
  const openRouterKeys = buildOpenRouterKeyPool(env);
  const openRouterModelIds = readOpenRouterModelIds(env);
  if (openRouterKeys.length > 0 && openRouterModelIds.length > 0) {
    console.log(`[analyze] Trying OpenRouter provider (${openRouterKeys.length} keys, ${openRouterModelIds.length} models)...`);
    for (const modelId of openRouterModelIds) {
      for (let attempt = 0; attempt < openRouterKeys.length; attempt += 1) {
        try {
          const orOutput = await callOpenRouterEval({
            apiKey: selectKey(openRouterKeys, attempt),
            modelId,
            systemText: prompt.systemText,
            userText: prompt.userText,
            fewShots: prompt.fewShots,
            imageBase64,
            referenceImages,
            targetMimeType: mimeType(imagePath),
          });
          return parseProviderOutput(orOutput, prompt, "openrouter", modelId);
        } catch (e) {
          console.warn(`OpenRouter failed (${modelId}, key ${attempt + 1}/${openRouterKeys.length}): ${publicErrorDetail(e)}`);
          lastError = e;
        }
      }
    }
  }

  // PRIORITY 2: HF Qwen
  const hfKey = env.HF_API_KEY;
  if (hfKey) {
    console.log(`[analyze] Trying HF provider...`);
    try {
      const qwenOutput = await callHuggingFaceQwen({
        apiKey: hfKey,
        systemText: prompt.systemText,
        userText: prompt.userText,
        fewShots: prompt.fewShots,
        imageBase64,
        referenceImages,
        targetMimeType: mimeType(imagePath),
      });
      return parseProviderOutput(qwenOutput, prompt, "hf", "Qwen/Qwen2.5-VL-72B-Instruct");
    } catch (e) {
      console.warn(`HF Qwen failed, falling back: ${publicErrorDetail(e)}`);
      lastError = e;
    }
  }

  // PRIORITY 3: Native Gemini
  const geminiKeys = buildGeminiKeyPool(env);
  if (geminiKeys.length > 0) {
    const modelId = env.MODEL_ID;
    console.log(`[analyze] Trying Gemini provider (${geminiKeys.length} keys)...`);
    for (let attempt = 0; attempt < geminiKeys.length; attempt++) {
      try {
        const rawOutput = await callGemini({
          apiKey: selectGeminiKey(geminiKeys, attempt),
          modelId: env.MODEL_ID,
          systemText: prompt.systemText,
          userText: prompt.userText,
          fewShots: prompt.fewShots,
          imageBase64,
          referenceImages,
          targetMimeType: mimeType(imagePath),
          maxAttempts: 1,
        });
        return parseProviderOutput(rawOutput, prompt, "gemini", modelId);
      } catch (error) {
        lastError = error;
        if (!isRetryableKeyError(error) || attempt === geminiKeys.length - 1) {
          throw error;
        }
      }
    }
  }

  if (lastError) throw lastError;
  console.error("[analyze] No working provider configured!", {
    hasHf: !!hfKey,
    openRouterKeyCount: openRouterKeys.length,
    openRouterModelCount: openRouterModelIds.length,
    geminiCount: geminiKeys.length,
    modelId: env.MODEL_ID
  });
  throw new Error("Analysis failed (no providers configured or all failed)");
}

function parseProviderOutput(
  rawOutput: string,
  prompt: Awaited<ReturnType<typeof loadPrompt>>,
  provider: "openrouter" | "hf" | "gemini",
  modelId: string,
) {
  let parsed: ReturnType<typeof parseEvidenceResponse> | null = null;
  let parseErr: string | null = null;
  try {
    parsed = parseEvidenceResponse(rawOutput);
  } catch (e) {
    parseErr = publicErrorDetail(e);
  }
  return { rawOutput, parsed, parseErr, prompt, provider, modelId };
}

async function callHuggingFaceQwen(args: {
  apiKey: string;
  systemText: string;
  userText: string;
  fewShots: any[];
  imageBase64: string;
  referenceImages: any[];
  targetMimeType: string;
}) {
  const url = "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-VL-72B-Instruct/v1/chat/completions";

  // HF Inference API has strict payload size limits (often 1MB-5MB). 
  // We can't send 7 reference images inline as base64 without blowing out the limit (413 Payload Too Large).
  // For the HF fallback, we must strip the reference images from the prompt.
  
  const promptText = [
    args.userText,
    "\nThe target image is the final image before these instructions. Return JSON only.",
  ].join("\n");

  const messages = [
    { role: "system", content: args.systemText },
    {
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${args.targetMimeType};base64,${args.imageBase64}` } },
        { type: "text", text: promptText }
      ]
    }
  ];

  const maxAttempts = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${args.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "Qwen/Qwen2.5-VL-72B-Instruct",
          messages,
          max_tokens: 256,
          temperature: 0,
        })
      });

      if (!res.ok) {
        if (res.status === 429 || res.status === 503) {
          throw new Error(`HF rate limit/unavailable: ${res.status}`);
        }
        throw new Error(`HF error: ${res.status} ${await res.text()}`);
      }

      const data = await res.json() as any;
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty response from HF Qwen");
      return content;
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000 * attempt));
      }
    }
  }
  throw lastError;
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

async function callOpenRouterEval(args: {
  apiKey: string;
  modelId: string;
  systemText: string;
  userText: string;
  fewShots: any[];
  imageBase64: string;
  referenceImages: any[];
  targetMimeType: string;
}) {
  return callOpenRouter({
    apiKey: args.apiKey,
    modelId: args.modelId,
    systemText: args.systemText,
    userText: args.userText,
    fewShots: args.fewShots,
    imageBase64: args.imageBase64,
    referenceImages: args.referenceImages,
    targetMimeType: args.targetMimeType,
    timeoutMs: 15000,
  });
}

function publicErrorDetail(error: unknown): string {
  if (error instanceof Error) {
    return error.message
      .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted-google-key]")
      .replace(/sk-or-v1-[0-9A-Za-z_-]{20,}/g, "[redacted-openrouter-key]")
      .replace(/"user_id"\s*:\s*"[^"]+"/g, "\"user_id\":\"[redacted-openrouter-user]\"")
      .replace(/xai-[0-9A-Za-z_-]{20,}/g, "[redacted-xai-key]")
      .replace(/gsk_[0-9A-Za-z_-]{20,}/g, "[redacted-groq-key]")
      .replace(/hf_[0-9A-Za-z_-]{20,}/g, "[redacted-huggingface-key]")
      .slice(0, 500);
  }
  return String(error).slice(0, 500);
}
