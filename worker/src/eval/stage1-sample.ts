#!/usr/bin/env tsx
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../env.js";
import { analyzeFixture } from "../llm/analyze.js";
import { compareMl, COMPARATOR_NAME, COMPARATOR_VERSION } from "./compare.js";

type SampleFixture = {
  imageId: string;
  imagePath: string;
  groundTruthMl: number;
};

type SampleManifest = {
  name?: string;
  fixtures: SampleFixture[];
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value ?? "true"];
  }),
);
const manifestPath = args.manifest ?? "worker/test/fixtures/stage1-sample/manifest.json";
const manifest = await readFixtureManifest(manifestPath);
const fixtures = manifest.fixtures;
const delayMs = readDelayMs(args.delayMs ?? args.delay);
const provider = readProvider(args.provider);
const includeRawOutput = args.includeRaw === "true";
const minExactAccuracy = readOptionalRatio(args.minExact ?? args.minExactAccuracy);
const minCloseAccuracy = readOptionalRatio(args.minClose ?? args.minCloseAccuracy);
const env = envForProvider(provider);
const runId = randomUUID();
const runStartedTs = new Date().toISOString();
const outDir = resolve(repoRoot, "runs", "stage1-sample");
await mkdir(outDir, { recursive: true });
const outPath = resolve(outDir, `${runStartedTs.replace(/[:.]/g, "-")}_${runId.slice(0, 8)}.json`);

const rows = [];
let exact = 0;
let close = 0;

for (let index = 0; index < fixtures.length; index += 1) {
  const fixture = fixtures[index];
  const started = Date.now();
  try {
    const { rawOutput, parsed, parseErr, prompt, provider: actualProvider, modelId } = await analyzeFixture(fixture.imagePath, env);
    const comparison = parsed ? compareMl(parsed.remainingMl, fixture.groundTruthMl) : null;
    if (comparison?.exactBucketPass) exact += 1;
    if (comparison?.closeBucketPass) close += 1;

    const row = {
      runId,
      runStartedTs,
      imageId: fixture.imageId,
      imagePath: fixture.imagePath,
      groundTruthMl: fixture.groundTruthMl,
      parsedMl: parsed?.remainingMl ?? null,
      nearestReferenceMl: parsed?.nearestReferenceMl ?? null,
      parsedConfidence: parsed?.confidence ?? null,
      absErrorMl: comparison?.absErrorMl ?? null,
      exactBucketPass: comparison?.exactBucketPass ?? false,
      closeBucketPass: comparison?.closeBucketPass ?? false,
      readingPossible: parsed?.readingPossible ?? null,
      qualityFlags: parsed?.qualityFlags ?? [],
      latencyMs: Date.now() - started,
      provider: actualProvider,
      modelId,
      promptHash: prompt.promptHash,
      fewshotHash: prompt.fewshotHash,
      comparatorName: COMPARATOR_NAME,
      comparatorVersion: COMPARATOR_VERSION,
      parseErr,
      rawOutput: includeRawOutput ? rawOutput : null,
    };
    rows.push(row);

    console.log(
      `[${index + 1}/${fixtures.length}] ${fixture.imageId} gt=${fixture.groundTruthMl}ml pred=${row.parsedMl ?? "ERR"}ml err=${row.absErrorMl ?? "ERR"} ` +
        `${row.exactBucketPass ? "exact" : row.closeBucketPass ? "close" : "miss"} conf=${row.parsedConfidence ?? "ERR"}`,
    );
  } catch (error) {
    rows.push({
      runId,
      runStartedTs,
      imageId: fixture.imageId,
      imagePath: fixture.imagePath,
      groundTruthMl: fixture.groundTruthMl,
      parsedMl: null,
      nearestReferenceMl: null,
      parsedConfidence: null,
      absErrorMl: null,
      exactBucketPass: false,
      closeBucketPass: false,
      readingPossible: null,
      qualityFlags: [],
      latencyMs: Date.now() - started,
      provider,
      modelId: env.MODEL_ID,
      promptHash: null,
      fewshotHash: null,
      comparatorName: COMPARATOR_NAME,
      comparatorVersion: COMPARATOR_VERSION,
      parseErr: publicErrorDetail(error),
      rawOutput: null,
    });
    console.log(`[${index + 1}/${fixtures.length}] ${fixture.imageId} gt=${fixture.groundTruthMl}ml pred=ERR err=ERR provider-error`);
  }

  if (delayMs > 0 && index < fixtures.length - 1) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
  }
}

const errors = rows
  .map((row) => row.absErrorMl)
  .filter((value): value is number => typeof value === "number");
const mae = errors.length ? errors.reduce((sum, error) => sum + error, 0) / errors.length : null;
const rmse = errors.length
  ? Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / errors.length)
  : null;
const report = {
  runId,
  runStartedTs,
  sample: manifest.name ?? "stage1-llm-api-requested-levels",
  provider,
  manifestPath,
  includeRawOutput,
  requestedLevels: fixtures.map((fixture) => fixture.imageId),
  exactToleranceMl: 55,
  closeToleranceMl: 110,
  exact,
  close,
  total: fixtures.length,
  exactAccuracy: exact / fixtures.length,
  closeAccuracy: close / fixtures.length,
  mae,
  rmse,
  rows,
};

await writeFile(outPath, JSON.stringify(report, null, 2) + "\n");

console.log("");
console.log(`exact (+/-55ml): ${exact}/${fixtures.length} = ${(100 * report.exactAccuracy).toFixed(1)}%`);
console.log(`close (+/-110ml): ${close}/${fixtures.length} = ${(100 * report.closeAccuracy).toFixed(1)}%`);
console.log(`MAE: ${mae === null ? "n/a" : `${mae.toFixed(1)}ml`}`);
console.log(`RMSE: ${rmse === null ? "n/a" : `${rmse.toFixed(1)}ml`}`);
console.log(`output: ${outPath}`);

const gateFailures: string[] = [];
if (minExactAccuracy !== null && report.exactAccuracy < minExactAccuracy) {
  gateFailures.push(`exact accuracy ${(100 * report.exactAccuracy).toFixed(1)}% is below ${(100 * minExactAccuracy).toFixed(1)}%`);
}
if (minCloseAccuracy !== null && report.closeAccuracy < minCloseAccuracy) {
  gateFailures.push(`close accuracy ${(100 * report.closeAccuracy).toFixed(1)}% is below ${(100 * minCloseAccuracy).toFixed(1)}%`);
}
if (gateFailures.length > 0) {
  console.error("");
  for (const failure of gateFailures) console.error(`accuracy gate failed: ${failure}`);
  process.exitCode = 1;
}

async function readFixtureManifest(path: string): Promise<SampleManifest> {
  const parsed = JSON.parse(await readFile(resolve(repoRoot, path), "utf8")) as SampleManifest;
  if (!Array.isArray(parsed.fixtures) || parsed.fixtures.length === 0) {
    throw new Error(`Stage 1 sample manifest has no fixtures: ${path}`);
  }
  return parsed;
}

function readDelayMs(value: string | undefined): number {
  if (!value) return 13000;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 13000;
}

function readOptionalRatio(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed;
  throw new Error(`Accuracy gates must be ratios from 0 to 1. Received: ${value}`);
}

function readProvider(value: string | undefined): "auto" | "gemini" | "openrouter" | "hf" {
  const provider = (value ?? "gemini").toLowerCase();
  if (provider === "auto" || provider === "gemini" || provider === "openrouter" || provider === "hf") {
    return provider;
  }
  throw new Error(`Unsupported provider "${value}". Use auto, gemini, openrouter, or hf.`);
}

function envForProvider(provider: "auto" | "gemini" | "openrouter" | "hf") {
  const base = loadEnv();
  if (provider === "auto") return base;
  if (provider === "openrouter") {
    return {
      ...base,
      GEMINI_API_KEY: "",
      GEMINI_API_KEYS: undefined,
      GEMINI_API_KEYS2: undefined,
      GEMINI_API_KEYS3: undefined,
      GEMINI_API_KEYS4: undefined,
      GEMINI_API_KEY2: undefined,
      GEMINI_API_KEY3: undefined,
      GEMINI_API_KEY4: undefined,
      HF_API_KEY: undefined,
      GROK_API_KEY: undefined,
      GROK_API_KEYS: undefined,
      GROK_API_KEY2: undefined,
      GROK_API_KEY3: undefined,
      GROK_API_KEY4: undefined,
    };
  }
  if (provider === "hf") {
    return {
      ...base,
      GEMINI_API_KEY: "",
      GEMINI_API_KEYS: undefined,
      GEMINI_API_KEYS2: undefined,
      GEMINI_API_KEYS3: undefined,
      GEMINI_API_KEYS4: undefined,
      GEMINI_API_KEY2: undefined,
      GEMINI_API_KEY3: undefined,
      GEMINI_API_KEY4: undefined,
      OPENROUTER_API_KEY: undefined,
      OPENROUTER_API_KEYS: undefined,
      OPENROUTER_API_KEY2: undefined,
      OPENROUTER_API_KEY3: undefined,
      OPENROUTER_API_KEY4: undefined,
      OPENROUTER_MODEL_ID: undefined,
      OPENROUTER_MODEL_IDS: undefined,
      GROK_API_KEY: undefined,
      GROK_API_KEYS: undefined,
      GROK_API_KEY2: undefined,
      GROK_API_KEY3: undefined,
      GROK_API_KEY4: undefined,
    };
  }
  return {
    ...base,
    OPENROUTER_API_KEY: undefined,
    OPENROUTER_API_KEYS: undefined,
    OPENROUTER_API_KEY2: undefined,
    OPENROUTER_API_KEY3: undefined,
    OPENROUTER_API_KEY4: undefined,
    OPENROUTER_MODEL_ID: undefined,
    OPENROUTER_MODEL_IDS: undefined,
    HF_API_KEY: undefined,
    GROK_API_KEY: undefined,
    GROK_API_KEYS: undefined,
    GROK_API_KEY2: undefined,
    GROK_API_KEY3: undefined,
    GROK_API_KEY4: undefined,
  };
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
