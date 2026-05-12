import { readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { callGemini } from "./gemini.js";
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

export async function analyzeFixture(imagePath: string, env: Env, promptVersion = "v1") {
  const prompt = await loadPrompt(promptVersion);
  const buf = await readFile(imagePath);
  const imageBase64 = buf.toString("base64");
  const referenceImages = await Promise.all(prompt.fewShots.map(async (shot) => ({
    label: `${shot.imagePath}: ${shot.expected.remainingMl}ml remaining`,
    mimeType: mimeType(shot.imagePath),
    data: (await readFile(resolve(repoRoot, shot.imagePath))).toString("base64"),
  })));
  const rawOutput = await callGemini({
    apiKey: env.GEMINI_API_KEY,
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
}
