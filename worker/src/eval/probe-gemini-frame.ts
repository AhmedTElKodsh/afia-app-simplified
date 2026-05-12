#!/usr/bin/env tsx
import { readFile, readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { compareMl } from "./compare.js";
import { parseEvidenceResponse } from "./parse-response.js";
import { callGemini } from "../llm/gemini.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const framesRoot = resolve(repoRoot, "oil-bottle-frames");
const refsRoot = resolve(framesRoot, "1.5L_refs");

function mimeType(path: string) {
  const ext = extname(path).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

async function listJpegs(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listJpegs(path));
    else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) files.push(path);
  }
  return files;
}

function groundTruthFromPath(path: string) {
  const match = path.match(/[\\/](empty|\d+ml)[\\/]/i);
  if (!match) throw new Error(`Could not infer ground truth from ${path}`);
  return match[1].toLowerCase() === "empty" ? 0 : Number.parseInt(match[1], 10);
}

function referenceMlFromFilename(path: string) {
  const file = path.split(/[\\/]/).at(-1)?.toLowerCase() ?? "";
  if (file.startsWith("empty")) return 0;
  const match = file.match(/^(\d+)ml/);
  if (!match) throw new Error(`Could not infer reference ml from ${path}`);
  return Number.parseInt(match[1], 10);
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("GEMINI_API_KEY missing");

const images = (await listJpegs(framesRoot))
  .filter((path) => !path.includes(`${refsRoot}`))
  .filter((path) => /[\\/](empty|\d+ml)[\\/]/i.test(path));

const chosen = images[Math.floor(Math.random() * images.length)];
const groundTruthMl = groundTruthFromPath(chosen);

const refFiles = ["1500ml.jpg", "750ml.jpg", "55ml.jpg", "empty.jpg"].map((name) => join(refsRoot, name));
const systemInstruction = [
  "You are a precise visual measurement assistant for Afia 1.5L cooking-oil bottles.",
  "Use calibrated reference images as anchors. Return JSON only. No prose. No markdown.",
].join("\n");

const prompt = [
  "The reference images appear first, then the target image.",
  "Estimate the target by locating the visible oil-air boundary and comparing it to the calibrated references.",
  "Do not infer from label artwork or bottle color alone.",
  "Return {\"readingPossible\": boolean, \"meniscusVisible\": \"yes\"|\"no\"|\"uncertain\", \"oilSurfaceYRatio\": number, \"nearestReferenceMl\": number, \"qualityFlags\": string[], \"confidence\": number}.",
].join("\n");

const rawOutput = await callGemini({
  apiKey,
  modelId: process.env.MODEL_ID ?? "gemini-2.5-flash",
  systemText: systemInstruction,
  userText: prompt,
  fewShots: [],
  imageBase64: (await readFile(chosen)).toString("base64"),
  targetMimeType: mimeType(chosen),
  referenceImages: await Promise.all(refFiles.map(async (path) => ({
    label: `${referenceMlFromFilename(path)}ml remaining`,
    mimeType: mimeType(path),
    data: (await readFile(path)).toString("base64"),
  }))),
});
let parsed: ReturnType<typeof parseEvidenceResponse> | null = null;
let comparison: ReturnType<typeof compareMl> | null = null;
let parseError: string | null = null;

try {
  parsed = parseEvidenceResponse(rawOutput);
  comparison = compareMl(parsed.remainingMl, groundTruthMl);
} catch (error) {
  parseError = (error as Error).message;
}

console.log(JSON.stringify({
  imagePath: chosen,
  referenceImages: refFiles,
  groundTruthMl,
  rawOutput,
  parseError,
  parsed,
  comparison,
}, null, 2));
