import { readFile } from "node:fs/promises";
import { callGemini } from "./gemini.js";
import { loadPrompt } from "../prompt/load.js";
import { parseAnalysisResponse } from "../eval/parse-response.js";
import type { Env } from "../env.js";

export async function analyzeFixture(imagePath: string, env: Env, promptVersion = "v1") {
  const prompt = await loadPrompt(promptVersion);
  const buf = await readFile(imagePath);
  const imageBase64 = buf.toString("base64");
  const rawOutput = await callGemini({
    apiKey: env.GEMINI_API_KEY,
    modelId: env.MODEL_ID,
    systemText: prompt.systemText,
    userText: prompt.userText,
    fewShots: prompt.fewShots,
    imageBase64,
  });
  let parsed: ReturnType<typeof parseAnalysisResponse> | null = null;
  let parseErr: string | null = null;
  try { parsed = parseAnalysisResponse(rawOutput); }
  catch (e) { parseErr = (e as Error).message; }
  return { rawOutput, parsed, parseErr, prompt };
}
