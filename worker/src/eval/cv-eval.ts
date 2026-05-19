#!/usr/bin/env tsx
import { extname, join, resolve, dirname } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { PipelineInput, PipelineOutput } from "../cv/pipeline.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

export interface CvEvalRow {
  imageId: string;
  groundTruthMl: number;
  cvMl: number | null;
  absErrorMl: number | null;
  exactBucketPass: boolean;
  closeBucketPass: boolean;
  tier: string;
  confidenceScore: number;
  fillRatio: number | null;
  contourFound: boolean;
  edgeStrength: number;
  stages: string[];
  missReason?: string;
  onnxScore?: number;
  fusionConfidence: number | null;
  fusionTier: string | null;
  fusionSource: string | null;
  fusionRemainingMl: number | null;
  fusionDisagreementPenalty: number | null;
  fusionValidSignalCount: number | null;
  fusionFallback: boolean;
  fusionSignalPresence: Record<string, boolean>;
  fusionIgnoredReasons: Record<string, string[]>;
  onnxHeuristicDeltaMl: number | null;
  onnxLoadStatus?: string;
}

export interface CvEvalSummary {
  manifestCount: number;
  evaluatedCount: number;
  exact: { count: number; pct: number };
  close: { count: number; pct: number };
  quality: {
    meanSignedErrorMl: number | null;
    meanAbsErrorMl: number | null;
    maxAbsErrorMl: number | null;
    errorBuckets: Record<string, number>;
    groundTruthBands: Record<string, {
      count: number;
      exactPct: number;
      closePct: number;
      meanSignedErrorMl: number | null;
    }>;
    highConfidenceWrongCount: number;
  };
  fusion: {
    sourceCounts: Record<string, number>;
    ignoredReasonCounts: Record<string, number>;
    disagreementPenaltyBuckets: Record<string, number>;
    validSignalCounts: Record<string, number>;
    tierDistribution: Record<string, number>;
    onnxHeuristicDeltaMl: { count: number; avg: number | null; max: number | null };
  };
}

type ManifestFixture = { imageId?: string; imagePath: string; groundTruthMl: number };
type Manifest = { name?: string; fixtures: ManifestFixture[] };

type Runner = (input: PipelineInput) => Promise<PipelineOutput>;

export async function runCvEval(options: {
  manifestPath: string;
  outPath?: string;
  dryRun?: boolean;
  runner?: Runner;
  log?: Pick<Console, "log" | "error">;
}): Promise<{ results: CvEvalRow[]; summary: CvEvalSummary; outPath: string }> {
  const log = options.log ?? console;
  const manifest = JSON.parse(await readFile(resolve(repoRoot, options.manifestPath), "utf8")) as Manifest;
  const fixtures = manifest.fixtures;
  const results: CvEvalRow[] = [];
  const latencies: number[] = [];
  const dryRun = options.dryRun ?? false;
  const runner = options.runner ?? (await import("../cv/pipeline.js")).runPipeline;
  const perImageDelayMs = Number(process.env.EVAL_DELAY_MS ?? process.env.RATE_LIMIT_DELAY_MS ?? 0);
  const shouldDelay = Number.isFinite(perImageDelayMs) && perImageDelayMs > 0;

  log.log("=== CV Pipeline Eval ===");
  log.log(`Manifest: ${manifest.name ?? options.manifestPath}`);
  log.log(`Testing ${fixtures.length} images\n`);

  let exact = 0, close = 0, n = 0;
  for (const fx of fixtures) {
    if (dryRun && n >= 1) break;
    const t0 = Date.now();
    n++;
    const imgPath = resolve(repoRoot, fx.imagePath);
    const groundTruthMl = fx.groundTruthMl;
    const buf = await readFile(imgPath);
    const ext = extname(imgPath).toLowerCase();
    const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;

    const result = await runner({
      imageData: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      imageBase64: dataUrl,
      geminiApiKey: GEMINI_API_KEY || undefined,
    });

    const row = rowFromPipelineResult(fx.imageId ?? fx.imagePath, groundTruthMl, result);
    if (row.exactBucketPass) exact++;
    if (row.closeBucketPass) close++;
    results.push(row);

    log.log(`[${n}/${fixtures.length}] ${row.imageId.split("/").pop()} gt=${groundTruthMl} cv=${row.cvMl ?? "ERR"} err=${row.absErrorMl ?? "?"} conf=${row.tier} fusion=${row.fusionSource ?? "N/A"} onnx=${row.onnxScore?.toFixed(2) ?? "N/A"} ${row.exactBucketPass ? "PASS" : "FAIL"}`);
    latencies.push(Date.now() - t0);
    if (shouldDelay && n < fixtures.length) await new Promise((r) => setTimeout(r, perImageDelayMs));
  }

  const summary = summarizeCvEval(results, fixtures.length);
  const outPath = options.outPath ? resolve(repoRoot, options.outPath) : resolve(repoRoot, "runs/cv-eval-200/cv-eval-results.json");
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify({ summary, results }, null, 2));

  printSummary(log, results, summary, latencies, outPath);
  await maybeCompareBaseline(log, results, exact, n);
  return { results, summary, outPath };
}

export function rowFromPipelineResult(imageId: string, groundTruthMl: number, result: PipelineOutput): CvEvalRow {
  const cvMl = result.fillRatio !== null ? Math.round(result.fillRatio * 1500) : null;
  const absErr = cvMl !== null ? Math.abs(cvMl - groundTruthMl) : null;
  const features = result.diagnostics.fusion?.features ?? {};
  const fusionRemainingMl = numericOrNull(result.diagnostics.fusion?.remainingMl);
  const heuristicEstimate = numericOrNull(features._fusionSignal_heuristic_estimateMl);
  const onnxEstimate = numericOrNull(features._fusionSignal_onnx_estimateMl);
  return {
    imageId,
    groundTruthMl,
    cvMl,
    absErrorMl: absErr,
    exactBucketPass: absErr !== null && absErr <= 55,
    closeBucketPass: absErr !== null && absErr <= 110,
    tier: result.tier,
    confidenceScore: result.confidence,
    fillRatio: result.fillRatio,
    contourFound: result.diagnostics.contourFound,
    edgeStrength: result.diagnostics.edgeStrength,
    stages: result.diagnostics.stages,
    missReason: result.diagnostics.missReason,
    onnxScore: result.diagnostics.onnxScore,
    onnxLoadStatus: result.diagnostics.onnxLoadStatus,
    fusionConfidence: numericOrNull(result.diagnostics.fusion?.confidence),
    fusionTier: result.diagnostics.fusion ? tierFromScore(result.diagnostics.fusion.confidence) : null,
    fusionSource: result.diagnostics.fusion?.source ?? null,
    fusionRemainingMl,
    fusionDisagreementPenalty: numericOrNull(features._fusionDisagreementPenalty),
    fusionValidSignalCount: numericOrNull(features._fusionValidSignalCount),
    fusionFallback: features._fusionFallback === 1,
    fusionSignalPresence: signalPresence(features),
    fusionIgnoredReasons: ignoredReasons(features),
    onnxHeuristicDeltaMl: onnxEstimate !== null && heuristicEstimate !== null ? round1(Math.abs(onnxEstimate - heuristicEstimate)) : null,
  };
}

export function summarizeCvEval(results: CvEvalRow[], manifestCount = results.length): CvEvalSummary {
  const exact = results.filter(r => r.exactBucketPass).length;
  const close = results.filter(r => r.closeBucketPass).length;
  const deltas = results.map(r => r.onnxHeuristicDeltaMl).filter((d): d is number => Number.isFinite(d));
  return {
    manifestCount,
    evaluatedCount: results.length,
    exact: { count: exact, pct: pct(exact, results.length) },
    close: { count: close, pct: pct(close, results.length) },
    quality: summarizeQuality(results),
    fusion: {
      sourceCounts: countBy(results, r => r.fusionSource ?? "missing"),
      ignoredReasonCounts: countIgnoredReasons(results),
      disagreementPenaltyBuckets: countBy(results, r => penaltyBucket(r.fusionDisagreementPenalty)),
      validSignalCounts: countBy(results, r => String(r.fusionValidSignalCount ?? "missing")),
      tierDistribution: countBy(results, r => r.fusionTier ?? "missing"),
      onnxHeuristicDeltaMl: {
        count: deltas.length,
        avg: deltas.length ? round1(deltas.reduce((s, d) => s + d, 0) / deltas.length) : null,
        max: deltas.length ? round1(Math.max(...deltas)) : null,
      },
    },
  };
}

function summarizeQuality(results: CvEvalRow[]): CvEvalSummary["quality"] {
  const measured = results.filter((r) => r.cvMl !== null && r.absErrorMl !== null);
  const signedErrors = measured.map((r) => (r.cvMl as number) - r.groundTruthMl);
  const absErrors = measured.map((r) => r.absErrorMl as number);
  return {
    meanSignedErrorMl: signedErrors.length ? round1(signedErrors.reduce((s, v) => s + v, 0) / signedErrors.length) : null,
    meanAbsErrorMl: absErrors.length ? round1(absErrors.reduce((s, v) => s + v, 0) / absErrors.length) : null,
    maxAbsErrorMl: absErrors.length ? round1(Math.max(...absErrors)) : null,
    errorBuckets: countBy(results, (r) => errorBucket(r.absErrorMl)),
    groundTruthBands: summarizeGroundTruthBands(results),
    highConfidenceWrongCount: results.filter((r) => r.confidenceScore >= 0.82 && !r.exactBucketPass).length,
  };
}

function summarizeGroundTruthBands(results: CvEvalRow[]): CvEvalSummary["quality"]["groundTruthBands"] {
  const groups = new Map<string, CvEvalRow[]>();
  for (const row of results) {
    const band = groundTruthBand(row.groundTruthMl);
    groups.set(band, [...(groups.get(band) ?? []), row]);
  }
  const out: CvEvalSummary["quality"]["groundTruthBands"] = {};
  for (const [band, rows] of [...groups.entries()].sort()) {
    const measured = rows.filter((r) => r.cvMl !== null);
    const signedErrors = measured.map((r) => (r.cvMl as number) - r.groundTruthMl);
    out[band] = {
      count: rows.length,
      exactPct: pct(rows.filter((r) => r.exactBucketPass).length, rows.length),
      closePct: pct(rows.filter((r) => r.closeBucketPass).length, rows.length),
      meanSignedErrorMl: signedErrors.length ? round1(signedErrors.reduce((s, v) => s + v, 0) / signedErrors.length) : null,
    };
  }
  return out;
}

function errorBucket(absErrorMl: number | null): string {
  if (absErrorMl === null) return "missing";
  if (absErrorMl <= 55) return "0-55";
  if (absErrorMl <= 110) return "56-110";
  if (absErrorMl <= 220) return "111-220";
  return ">220";
}

function groundTruthBand(ml: number): string {
  if (ml <= 110) return "empty";
  if (ml <= 440) return "low";
  if (ml <= 990) return "mid";
  if (ml <= 1390) return "high";
  return "full";
}

function signalPresence(features: Record<string, number>): Record<string, boolean> {
  const sources = ["heuristic", "onnx", "llm"];
  return Object.fromEntries(sources.map(s => [s, Object.keys(features).some(k => k.startsWith(`_fusionSignal_${s}_`))]));
}

function ignoredReasons(features: Record<string, number>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(features)) {
    if (value !== 1 || !key.startsWith("_fusionIgnored_")) continue;
    const rest = key.slice("_fusionIgnored_".length);
    const [source, ...reasonParts] = rest.split("_");
    (out[source] ??= []).push(reasonParts.join("_") || "ignored");
  }
  return out;
}

function countIgnoredReasons(results: CvEvalRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of results) for (const [source, reasons] of Object.entries(row.fusionIgnoredReasons)) {
    for (const reason of reasons) counts[`${source}:${reason}`] = (counts[`${source}:${reason}`] ?? 0) + 1;
  }
  return counts;
}

function penaltyBucket(v: number | null): string {
  if (v === null) return "missing";
  if (v === 0) return "0";
  if (v < 0.1) return "0-0.1";
  if (v < 0.25) return "0.1-0.25";
  return ">=0.25";
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function numericOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function round1(v: number): number { return Math.round(v * 10) / 10; }
function pct(count: number, total: number): number { return total > 0 ? round1(100 * count / total) : 0; }
function tierFromScore(score: number): "high" | "medium" | "low" { return score >= 0.82 ? "high" : score >= 0.55 ? "medium" : "low"; }

function printSummary(log: Pick<Console, "log">, results: CvEvalRow[], summary: CvEvalSummary, latencies: number[], outPath: string): void {
  const n = results.length;
  log.log(`\n=== CV Pipeline Results (${summary.manifestCount} manifest rows; ${n} evaluated) ===`);
  log.log(`exact (+/-55ml): ${summary.exact.count}/${n} = ${summary.exact.pct.toFixed(1)}%`);
  log.log(`close (+/-110ml): ${summary.close.count}/${n} = ${summary.close.pct.toFixed(1)}%`);
  const contourFoundCount = results.filter(r => r.contourFound).length;
  log.log(`contour found: ${contourFoundCount}/${n} = ${pct(contourFoundCount, n).toFixed(1)}%`);

  if (latencies.length > 0) {
    const sorted = [...latencies].sort((a, b) => a - b);
    const avg = latencies.reduce((s, v) => s + v, 0) / latencies.length;
    log.log(`\nLatency (ms): avg=${avg.toFixed(0)} p50=${sorted[Math.floor(sorted.length * 0.5)]} p95=${sorted[Math.floor(sorted.length * 0.95)]} p99=${sorted[Math.floor(sorted.length * 0.99)]}`);
  }

  log.log(`\nFusion source counts: ${JSON.stringify(summary.fusion.sourceCounts)}`);
  log.log(`Fusion ignored reasons: ${JSON.stringify(summary.fusion.ignoredReasonCounts)}`);
  log.log(`Fusion disagreement buckets: ${JSON.stringify(summary.fusion.disagreementPenaltyBuckets)}`);
  log.log(`Fusion tier distribution: ${JSON.stringify(summary.fusion.tierDistribution)}`);
  log.log(`ONNX vs heuristic delta: ${JSON.stringify(summary.fusion.onnxHeuristicDeltaMl)}`);
  log.log(`Quality diagnostics: ${JSON.stringify(summary.quality)}`);

  const worst = results.filter((r) => r.absErrorMl !== null).sort((a, b) => (b.absErrorMl ?? 0) - (a.absErrorMl ?? 0)).slice(0, 5);
  log.log(`\nWorst misses:`);
  for (const w of worst) log.log(`  ${w.imageId} gt=${w.groundTruthMl} cv=${w.cvMl} err=${w.absErrorMl} conf=${w.tier}(${w.confidenceScore.toFixed(2)}) fusion=${w.fusionSource ?? "N/A"} onnx=${w.onnxScore?.toFixed(2) ?? "N/A"}`);
  log.log(`\nResults written: ${outPath}`);
}

async function maybeCompareBaseline(log: Pick<Console, "log" | "error">, results: CvEvalRow[], exact: number, n: number): Promise<void> {
  const baselinePath = process.env.BASELINE_RUN;
  if (!baselinePath) return;
  try {
    const baselineRaw = JSON.parse(await readFile(baselinePath, "utf8"));
    const baseline = Array.isArray(baselineRaw) ? baselineRaw : baselineRaw.results;
    const baselineExact = baseline.filter((r: any) => r.exactBucketPass).length;
    const deltaPct = ((exact / n) - (baselineExact / baseline.length)) * 100;
    log.log(`\n=== Regression Check (vs ${baselinePath}) ===`);
    log.log(`  Baseline: ${baselineExact}/${baseline.length} = ${(100 * baselineExact / baseline.length).toFixed(1)}% exact`);
    log.log(`  Current:  ${exact}/${n} = ${(100 * exact / n).toFixed(1)}% exact`);
    log.log(`  Delta:    ${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}pp`);
    const regressionThreshold = Number(process.env.REGRESSION_THRESHOLD_PCT) || 2.0;
    if (deltaPct < -regressionThreshold) {
      log.error(`\nREGRESSION DETECTED: Exact accuracy dropped by ${Math.abs(deltaPct).toFixed(1)}pp (threshold: ${regressionThreshold}pp)`);
      process.exit(1);
    }
    log.log(`\nNo regression (threshold: ${regressionThreshold}pp)`);
  } catch (e) {
    log.error(`\nCould not read baseline: ${(e as Error).message}`);
  }
}

const invokedPath = process.argv[1] ? fileURLToPath(pathToFileURL(resolve(process.argv[1]))) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const manifestPathArg = process.argv.find(a => !a.startsWith("-") && a.endsWith(".json"));
  await runCvEval({
    manifestPath: manifestPathArg ?? "worker/test/fixtures/cv-eval/manifest.json",
    dryRun: process.argv.includes("--dry-run"),
  });
}
