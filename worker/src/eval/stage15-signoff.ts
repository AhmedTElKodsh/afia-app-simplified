#!/usr/bin/env tsx
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

const DEFAULT_EVAL_PATH = "runs/cv-eval-200/cv-eval-results.json";
const DEFAULT_OUT_DIR = "runs/stage15-signoff";
const EXACT_TARGET_PCT = 90;
const CLOSE_TARGET_PCT = 95;

const REQUIRED_ROW_FIELDS = [
  "imageId",
  "groundTruthMl",
  "cvMl",
  "absErrorMl",
  "exactBucketPass",
  "closeBucketPass",
  "tier",
  "confidenceScore",
  "fillRatio",
  "contourFound",
  "edgeStrength",
  "stages",
] as const;

const REQUIRED_FUSION_FIELDS = [
  "fusionConfidence",
  "fusionTier",
  "fusionSource",
  "fusionRemainingMl",
  "fusionDisagreementPenalty",
  "fusionValidSignalCount",
  "fusionFallback",
  "fusionSignalPresence",
  "fusionIgnoredReasons",
  "onnxHeuristicDeltaMl",
] as const;

export interface Stage15SignoffOptions {
  evalPath?: string;
  packagePath?: string;
  outDir?: string;
  now?: Date;
}

export interface Stage15Gate {
  id: string;
  status: "pass" | "no-go";
  reasons: string[];
}

export interface Stage15Anomaly {
  row: number | "summary" | "package";
  imageId?: string;
  field: string;
  reason: string;
}

export interface Stage15SignoffReport {
  generatedAt: string;
  source: {
    evalArtifact: string;
    packageJson: string;
  };
  verdict: "go" | "no-go";
  gates: {
    accuracy: Stage15Gate;
    diagnostics: Stage15Gate;
    runtimeCompatibility: Stage15Gate;
    artifactShape: Stage15Gate;
  };
  metrics: {
    manifestCount: number;
    evaluatedCount: number;
    exact: { count: number; pct: number; targetPct: number };
    close: { count: number; pct: number; targetPct: number };
  };
  diagnostics: {
    missingFusionFieldRows: number;
    missingFusionFields: Record<string, number>;
    nullFusionValueCounts: Record<string, number>;
    nullMetricCounts: Record<string, number>;
    nonFiniteNumberRows: number;
    anomalies: Stage15Anomaly[];
  };
  fusion: {
    sourceCounts: Record<string, number>;
    ignoredReasonCounts: Record<string, number>;
    disagreementPenaltyBuckets: Record<string, number>;
    validSignalCounts: Record<string, number>;
    tierDistribution: Record<string, number>;
    onnxHeuristicDeltaMl: { count: number; avg: number | null; max: number | null };
  };
  qualityDiagnostics: JsonObject | null;
  runtimeCompatibility: {
    sharpDependencyPresent: boolean;
    checkedSections: string[];
  };
  recommendedNextActions: string[];
}

type JsonObject = Record<string, unknown>;

export async function generateStage15Signoff(options: Stage15SignoffOptions = {}): Promise<Stage15SignoffReport> {
  const evalPath = options.evalPath ?? DEFAULT_EVAL_PATH;
  const packagePath = options.packagePath ?? "worker/package.json";
  const outDir = options.outDir ?? DEFAULT_OUT_DIR;

  const artifact = await readEvalArtifact(evalPath);
  const packageJson = await readJsonFile(resolve(repoRoot, packagePath), `package.json at ${packagePath}`) as JsonObject;
  const report = createStage15SignoffReport({
    artifact,
    packageJson,
    evalPath,
    packagePath,
    now: options.now ?? new Date(),
  });

  const resolvedOutDir = resolve(repoRoot, outDir);
  await mkdir(resolvedOutDir, { recursive: true });
  await writeFile(resolve(resolvedOutDir, "stage15-signoff.json"), JSON.stringify(report, null, 2) + "\n");
  await writeFile(resolve(resolvedOutDir, "stage15-signoff.md"), renderStage15Markdown(report));
  return report;
}

export function createStage15SignoffReport(input: {
  artifact: unknown;
  packageJson: JsonObject;
  evalPath?: string;
  packagePath?: string;
  now?: Date;
}): Stage15SignoffReport {
  const { summary, results } = validateEvalArtifact(input.artifact);
  const anomalies = collectAnomalies(summary, results);
  const missingFusionFields: Record<string, number> = {};
  const nullFusionValueCounts: Record<string, number> = {};
  let missingFusionFieldRows = 0;

  results.forEach((row, index) => {
    let rowMissing = false;
    for (const field of REQUIRED_FUSION_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(row, field)) {
        missingFusionFields[field] = (missingFusionFields[field] ?? 0) + 1;
        rowMissing = true;
        anomalies.push({ row: index, imageId: String(row.imageId), field, reason: "missing fusion diagnostic field" });
      } else if (row[field] === null) {
        nullFusionValueCounts[field] = (nullFusionValueCounts[field] ?? 0) + 1;
      }
    }
    if (rowMissing) missingFusionFieldRows++;
  });

  const runtimeCompatibility = checkRuntimeCompatibility(input.packageJson);
  if (runtimeCompatibility.sharpDependencyPresent) {
    anomalies.push({ row: "package", field: "sharp", reason: "native sharp dependency is present in worker package.json" });
  }

  const exactPct = numericSummaryPct(summary, "exact");
  const closePct = numericSummaryPct(summary, "close");
  const accuracyReasons: string[] = [];
  if (exactPct < EXACT_TARGET_PCT) accuracyReasons.push(`exact accuracy ${exactPct}% is below target ${EXACT_TARGET_PCT}%`);
  if (closePct < CLOSE_TARGET_PCT) accuracyReasons.push(`close accuracy ${closePct}% is below target ${CLOSE_TARGET_PCT}%`);

  const diagnosticReasons: string[] = [];
  if (missingFusionFieldRows > 0) diagnosticReasons.push(`${missingFusionFieldRows} result row(s) are missing fusion diagnostic fields`);
  const nonFiniteNumberRows = new Set(anomalies.filter(a => a.reason.includes("non-finite")).map(a => a.row)).size;
  if (nonFiniteNumberRows > 0) diagnosticReasons.push(`${nonFiniteNumberRows} row(s) contain non-finite numeric values`);
  const qualityDiagnostics = isObject(summary.quality) ? summary.quality : null;
  const highConfidenceWrongCount = qualityDiagnostics && Number.isFinite(qualityDiagnostics.highConfidenceWrongCount)
    ? Number(qualityDiagnostics.highConfidenceWrongCount)
    : 0;
  if (highConfidenceWrongCount > 0) diagnosticReasons.push(`${highConfidenceWrongCount} high-confidence wrong row(s) in eval artifact`);

  const runtimeReasons = runtimeCompatibility.sharpDependencyPresent ? ["worker/package.json still declares sharp"] : [];
  const artifactReasons = anomalies.filter(a => a.reason.startsWith("malformed")).map(a => `${a.row}:${a.field} ${a.reason}`);

  const gates = {
    accuracy: gate("accuracy", accuracyReasons),
    diagnostics: gate("diagnostics", diagnosticReasons),
    runtimeCompatibility: gate("runtimeCompatibility", runtimeReasons),
    artifactShape: gate("artifactShape", artifactReasons),
  };
  const verdict = Object.values(gates).every(g => g.status === "pass") ? "go" : "no-go";

  return {
    generatedAt: (input.now ?? new Date()).toISOString(),
    source: {
      evalArtifact: input.evalPath ?? DEFAULT_EVAL_PATH,
      packageJson: input.packagePath ?? "worker/package.json",
    },
    verdict,
    gates,
    metrics: {
      manifestCount: summary.manifestCount,
      evaluatedCount: summary.evaluatedCount,
      exact: { count: summary.exact.count, pct: summary.exact.pct, targetPct: EXACT_TARGET_PCT },
      close: { count: summary.close.count, pct: summary.close.pct, targetPct: CLOSE_TARGET_PCT },
    },
    diagnostics: {
      missingFusionFieldRows,
      missingFusionFields,
      nullFusionValueCounts,
      nullMetricCounts: countNullMetrics(results),
      nonFiniteNumberRows,
      anomalies,
    },
    fusion: summary.fusion,
    qualityDiagnostics,
    runtimeCompatibility,
    recommendedNextActions: recommendedNextActions({ verdict, gates, runtimeCompatibility }),
  };
}

export function validateEvalArtifact(artifact: unknown): { summary: any; results: JsonObject[] } {
  if (!isObject(artifact)) throw malformed("artifact root must be an object");
  const summary = artifact.summary;
  const results = artifact.results;
  const errors: string[] = [];
  if (!isObject(summary)) errors.push("summary: malformed or missing object");
  if (!Array.isArray(results)) errors.push("results: malformed or missing array");
  if (errors.length > 0) throw malformed(errors.join("; "));

  const s = summary as JsonObject;
  for (const field of ["manifestCount", "evaluatedCount"] as const) {
    if (!Number.isFinite(s[field])) errors.push(`summary.${field}: malformed number`);
  }
  for (const field of ["exact", "close"] as const) {
    const metric = s[field];
    if (!isObject(metric) || !Number.isFinite(metric.count) || !Number.isFinite(metric.pct)) {
      errors.push(`summary.${field}: malformed count/pct`);
    }
  }
  if (!isObject(s.fusion)) errors.push("summary.fusion: malformed or missing object");

  (results as unknown[]).forEach((row, index) => {
    if (!isObject(row)) {
      errors.push(`results[${index}]: malformed row object`);
      return;
    }
    for (const field of REQUIRED_ROW_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(row, field)) errors.push(`results[${index}].${field}: missing required field`);
    }
    if (typeof row.imageId !== "string") errors.push(`results[${index}].imageId: malformed string`);
    for (const boolField of ["exactBucketPass", "closeBucketPass", "contourFound"] as const) {
      if (typeof row[boolField] !== "boolean") errors.push(`results[${index}].${boolField}: malformed boolean`);
    }
    if (!Array.isArray(row.stages)) errors.push(`results[${index}].stages: malformed array`);
  });

  if (errors.length > 0) throw malformed(errors.join("; "));
  return { summary: s, results: results as JsonObject[] };
}

export function renderStage15Markdown(report: Stage15SignoffReport): string {
  const gateRows = Object.values(report.gates)
    .map(g => `| ${g.id} | ${g.status} | ${g.reasons.length ? g.reasons.join("; ") : "passed"} |`)
    .join("\n");
  const actions = report.recommendedNextActions.map(a => `- ${a}`).join("\n");
  return `# Stage 1.5 Sign-off Report\n\n` +
    `Generated: ${report.generatedAt}\n\n` +
    `Verdict: **${report.verdict.toUpperCase()}**\n\n` +
    `## Gates\n\n| Gate | Status | Reasons |\n|---|---|---|\n${gateRows}\n\n` +
    `## Accuracy\n\n` +
    `- Manifest rows: ${report.metrics.manifestCount}\n` +
    `- Evaluated rows: ${report.metrics.evaluatedCount}\n` +
    `- Exact +/-55ml: ${report.metrics.exact.count}/${report.metrics.evaluatedCount} = ${report.metrics.exact.pct}% (target ${report.metrics.exact.targetPct}%)\n` +
    `- Close +/-110ml: ${report.metrics.close.count}/${report.metrics.evaluatedCount} = ${report.metrics.close.pct}% (target ${report.metrics.close.targetPct}%)\n\n` +
    `## Quality Diagnostics\n\n` +
    `- Quality summary: \`${JSON.stringify(report.qualityDiagnostics ?? {})}\`\n\n` +
    `## Fusion Diagnostics\n\n` +
    `- Source counts: \`${JSON.stringify(report.fusion.sourceCounts)}\`\n` +
    `- Ignored reasons: \`${JSON.stringify(report.fusion.ignoredReasonCounts)}\`\n` +
    `- Disagreement buckets: \`${JSON.stringify(report.fusion.disagreementPenaltyBuckets)}\`\n` +
    `- Valid signal counts: \`${JSON.stringify(report.fusion.validSignalCounts)}\`\n` +
    `- Tier distribution: \`${JSON.stringify(report.fusion.tierDistribution)}\`\n` +
    `- ONNX/heuristic delta: \`${JSON.stringify(report.fusion.onnxHeuristicDeltaMl)}\`\n` +
    `- Rows missing fusion fields: ${report.diagnostics.missingFusionFieldRows}\n` +
    `- Missing fusion fields: \`${JSON.stringify(report.diagnostics.missingFusionFields)}\`\n` +
    `- Null fusion values: \`${JSON.stringify(report.diagnostics.nullFusionValueCounts)}\`\n` +
    `- Null metrics: \`${JSON.stringify(report.diagnostics.nullMetricCounts)}\`\n` +
    `- Non-finite numeric rows: ${report.diagnostics.nonFiniteNumberRows}\n\n` +
    `## Runtime Compatibility\n\n` +
    `- Sharp dependency present: ${report.runtimeCompatibility.sharpDependencyPresent ? "yes" : "no"}\n` +
    `- Checked package sections: ${report.runtimeCompatibility.checkedSections.join(", ")}\n\n` +
    `## Recommended Next Actions\n\n${actions}\n\n` +
    `## Inspection Sources\n\n` +
    `- Eval artifact: \`${report.source.evalArtifact}\`\n` +
    `- Package manifest: \`${report.source.packageJson}\`\n`;
}

async function readEvalArtifact(evalPath: string): Promise<unknown> {
  try {
    return await readJsonFile(resolve(repoRoot, evalPath), `eval artifact at ${evalPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ENOENT")) {
      throw new Error(`Missing eval artifact: ${evalPath}. Run: pnpm eval:edge`);
    }
    throw error;
  }
}

async function readJsonFile(path: string, label: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read ${label}: ${message}`);
  }
}

function checkRuntimeCompatibility(packageJson: JsonObject): Stage15SignoffReport["runtimeCompatibility"] {
  const checkedSections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
  const sharpDependencyPresent = checkedSections.some((section) => isObject(packageJson[section]) && Object.prototype.hasOwnProperty.call(packageJson[section], "sharp"));
  return { sharpDependencyPresent, checkedSections };
}

function collectAnomalies(summary: JsonObject, rows: JsonObject[]): Stage15Anomaly[] {
  const anomalies: Stage15Anomaly[] = [];
  scanNumbers(summary, "summary", "summary", anomalies);
  rows.forEach((row, index) => scanNumbers(row, index, String(row.imageId ?? `row-${index}`), anomalies));
  return anomalies;
}

function scanNumbers(value: unknown, row: number | "summary", imageId: string, anomalies: Stage15Anomaly[], path = ""): void {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) anomalies.push({ row, imageId, field: path, reason: "non-finite numeric value" });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanNumbers(item, row, imageId, anomalies, `${path}[${index}]`));
    return;
  }
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) scanNumbers(child, row, imageId, anomalies, path ? `${path}.${key}` : key);
  }
}

function countNullMetrics(rows: JsonObject[]): Record<string, number> {
  const fields = ["cvMl", "absErrorMl", "fillRatio", "fusionConfidence", "fusionRemainingMl", "fusionDisagreementPenalty", "fusionValidSignalCount", "onnxHeuristicDeltaMl"];
  const counts: Record<string, number> = {};
  for (const row of rows) {
    for (const field of fields) {
      if (row[field] === null) counts[field] = (counts[field] ?? 0) + 1;
    }
  }
  return counts;
}

function recommendedNextActions(input: {
  verdict: "go" | "no-go";
  gates: Stage15SignoffReport["gates"];
  runtimeCompatibility: Stage15SignoffReport["runtimeCompatibility"];
}): string[] {
  const actions: string[] = [];
  if (input.gates.accuracy.status === "no-go") actions.push("Do not fund Stage 2 from current CV metrics; improve fusion/CV accuracy and rerun pnpm eval:edge.");
  if (input.gates.diagnostics.status === "no-go") actions.push("Regenerate eval artifacts with fusion-aware diagnostics before relying on the report for trend analysis.");
  if (input.runtimeCompatibility.sharpDependencyPresent) actions.push("Remove the native sharp dependency from the Worker package or move it outside the Worker runtime boundary.");
  if (actions.length === 0) actions.push("Stage 1.5 gates are green; preserve this report with the eval artifact for stakeholder review.");
  return actions;
}

function gate(id: string, reasons: string[]): Stage15Gate {
  return { id, status: reasons.length ? "no-go" : "pass", reasons };
}

function numericSummaryPct(summary: JsonObject, field: "exact" | "close"): number {
  const metric = summary[field] as JsonObject;
  return Number(metric.pct);
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function malformed(message: string): Error {
  return new Error(`Malformed cv eval artifact: ${message}`);
}

const invokedPath = process.argv[1] ? fileURLToPath(pathToFileURL(resolve(process.argv[1]))) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const report = await generateStage15Signoff();
    console.log(`Stage 1.5 sign-off report written to ${DEFAULT_OUT_DIR}`);
    console.log(`Verdict: ${report.verdict.toUpperCase()}`);
    for (const gateReport of Object.values(report.gates)) {
      console.log(`- ${gateReport.id}: ${gateReport.status}${gateReport.reasons.length ? ` (${gateReport.reasons.join("; ")})` : ""}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
