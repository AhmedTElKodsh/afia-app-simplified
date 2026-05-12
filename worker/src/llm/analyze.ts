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

function isQuotaLikeError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { status?: number; message?: string };
  return maybeError.status === 429 || /quota exceeded|too many requests|rate limit/i.test(maybeError.message ?? "");
}

export async function analyzeFixture(imagePath: string, env: Env, promptVersion = "v1") {
  const prompt = await loadPrompt(promptVersion);
  const buf = await readFile(imagePath);
  const imageBase64 = buf.toString("base64");
  const referenceImages = await Promise.all(prompt.fewShots.map(async (shot) => ({
    label: `${shot.expected.nearestReferenceMl}ml reference`,
    mimeType: mimeType(shot.imagePath),
    data: (await readFile(resolve(repoRoot, shot.imagePath))).toString("base64"),
  })));

  const hfKey = env.HF_API_KEY;
  if (hfKey) {
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
  }

  const geminiKeys = buildGeminiKeyPool(env);
  let lastError: unknown;

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
      if (!isQuotaLikeError(error) || attempt === geminiKeys.length - 1) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("Gemini analysis failed");
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
