import { readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { callGemini } from "./gemini.js";
import { buildGeminiKeyPool, selectGeminiKey } from "./rotation.js";
import { loadPrompt } from "../prompt/load.js";
import { parseEvidenceResponse } from "../eval/parse-response.js";
import type { Env } from "../env.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function mimeType(path: string) {
  const ext = extname(path).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function isRetryableKeyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { status?: number; message?: string };
  if (maybeError.status === 403) return true; // leaked/revoked key — try next
  return maybeError.status === 429 || /quota exceeded|too many requests|rate limit/i.test(maybeError.message ?? "");
}

export async function analyzeFixture(imagePath: string, env: Env, promptVersion = "v1") {
  const prompt = await loadPrompt(promptVersion);
  const buf = await readFile(resolve(repoRoot, imagePath));
  const imageBase64 = buf.toString("base64");
  const referenceImages = await Promise.all(prompt.fewShots.map(async (shot) => ({
    label: `${shot.expected.nearestReferenceMl}ml reference`,
    mimeType: mimeType(shot.imagePath),
    data: (await readFile(resolve(repoRoot, shot.imagePath))).toString("base64"),
  })));

  let lastError: unknown;

  /*
  // PRIORITY 1: OpenRouter (to test more capable models like Qwen2.5-VL or Gemini 2.0)
  const orKey = env.OPENROUTER_API_KEY;
  if (orKey) {
    const modelId = env.OPENROUTER_MODEL_ID ?? "google/gemini-2.0-flash-exp:free";
    console.log(`[analyze] Trying OpenRouter provider (model: ${modelId})...`);
    try {
      const orOutput = await callOpenRouter({
        apiKey: orKey,
        modelId,
        systemText: prompt.systemText,
        userText: prompt.userText,
        fewShots: prompt.fewShots,
        imageBase64,
        referenceImages,
        targetMimeType: mimeType(imagePath),
      });
      let parsed: ReturnType<typeof parseEvidenceResponse> | null = null;
      let parseErr: string | null = null;
      try { parsed = parseEvidenceResponse(orOutput); }
      catch (e) { parseErr = (e as Error).message; }
      return { rawOutput: orOutput, parsed, parseErr, prompt };
    } catch (e) {
      console.warn(`OpenRouter failed: ${(e as Error).message}`);
      lastError = e;
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
      let parsed: ReturnType<typeof parseEvidenceResponse> | null = null;
      let parseErr: string | null = null;
      try { parsed = parseEvidenceResponse(qwenOutput); }
      catch (e) { parseErr = (e as Error).message; }
      return { rawOutput: qwenOutput, parsed, parseErr, prompt };
    } catch (e) {
      console.warn(`HF Qwen failed, falling back: ${(e as Error).message}`);
      lastError = e;
    }
  }
  */

  // PRIORITY 3: Native Gemini
  const geminiKeys = buildGeminiKeyPool(env);
  if (geminiKeys.length > 0) {
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
        });
        let parsed: ReturnType<typeof parseEvidenceResponse> | null = null;
        let parseErr: string | null = null;
        try { parsed = parseEvidenceResponse(rawOutput); }
        catch (e) { parseErr = (e as Error).message; }
        return { rawOutput, parsed, parseErr, prompt };
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
    hasOr: !!orKey,
    geminiCount: geminiKeys.length,
    modelId: env.MODEL_ID
  });
  throw new Error("Analysis failed (no providers configured or all failed)");
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

async function callOpenRouter(args: {
  apiKey: string;
  modelId: string;
  systemText: string;
  userText: string;
  fewShots: any[];
  imageBase64: string;
  referenceImages: any[];
  targetMimeType: string;
}) {
  const url = "https://openrouter.ai/api/v1/chat/completions";

  // OpenRouter supports multiple images in a single turn.
  // We'll include the reference images to help calibration if the model supports it.
  // However, many free models have context limits, so we'll be careful.
  
  const promptText = [
    args.userText,
    "\nThe target image is the final image. Return JSON only.",
  ].join("\n");

  const messages = [
    { role: "system", content: args.systemText },
    {
      role: "user",
      content: [
        ...args.referenceImages.map(img => ({
          type: "image_url",
          image_url: { url: `data:${img.mimeType};base64,${img.data}` }
        })),
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
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/afia-app/afia-app-simplified",
          "X-Title": "Afia Bottle Analysis Eval"
        },
        body: JSON.stringify({
          model: args.modelId,
          messages,
          temperature: 0,
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        if (res.status === 429) {
          throw new Error(`OpenRouter rate limit: ${errorText}`);
        }
        throw new Error(`OpenRouter error: ${res.status} ${errorText}`);
      }

      const data = await res.json() as any;
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        console.error("Full OpenRouter response:", JSON.stringify(data, null, 2));
        throw new Error("Empty response from OpenRouter");
      }
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
