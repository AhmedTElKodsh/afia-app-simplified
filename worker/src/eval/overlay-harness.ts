import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { PipelineOutput } from "../cv/pipeline.js";

export interface OverlayHarnessRecord {
  imageId: string;
  imagePath: string;
  groundTruthMl: number;
  predictedMl: number | null;
  absErrorMl: number | null;
  stageMetrics: Record<string, number | string | boolean | null>;
  diagnostics: Pick<PipelineOutput["diagnostics"], "bottleRect" | "lineCandidates" | "selectedLineSource" | "measurementState" | "missReason">;
}

export async function writeOverlayHarnessArtifacts(args: {
  outDir: string;
  imageId: string;
  imagePath: string;
  imageBytes: Uint8Array;
  groundTruthMl: number;
  bottleSizeMl: number;
  result: PipelineOutput;
}): Promise<{ jsonPath: string; svgPath: string }> {
  await mkdir(args.outDir, { recursive: true });
  const stem = sanitizeStem(args.imageId || basename(args.imagePath));
  const jsonPath = resolve(args.outDir, `${stem}.overlay.json`);
  const svgPath = resolve(args.outDir, `${stem}.overlay.svg`);
  const record = buildOverlayHarnessRecord(args);
  await writeFile(jsonPath, JSON.stringify(record, null, 2) + "\n");
  await writeFile(svgPath, renderOverlaySvg(args, record));
  return { jsonPath, svgPath };
}

export function buildOverlayHarnessRecord(args: {
  imageId: string;
  imagePath: string;
  groundTruthMl: number;
  bottleSizeMl: number;
  result: PipelineOutput;
}): OverlayHarnessRecord {
  const predictedMl = args.result.fillRatio === null ? null : Math.round(args.result.fillRatio * args.bottleSizeMl);
  return {
    imageId: args.imageId,
    imagePath: args.imagePath,
    groundTruthMl: args.groundTruthMl,
    predictedMl,
    absErrorMl: predictedMl === null ? null : Math.abs(predictedMl - args.groundTruthMl),
    stageMetrics: stageMetricsFromPipeline(args.result),
    diagnostics: {
      bottleRect: args.result.diagnostics.bottleRect,
      lineCandidates: args.result.diagnostics.lineCandidates,
      selectedLineSource: args.result.diagnostics.selectedLineSource,
      measurementState: args.result.diagnostics.measurementState,
      missReason: args.result.diagnostics.missReason,
    },
  };
}

export function stageMetricsFromPipeline(result: PipelineOutput): Record<string, number | string | boolean | null> {
  return {
    success: result.success,
    tier: result.tier,
    confidence: round4(result.confidence),
    contourFound: result.diagnostics.contourFound,
    measurementState: result.diagnostics.measurementState ?? null,
    selectedLineSource: result.diagnostics.selectedLineSource ?? null,
    candidateCount: result.diagnostics.lineCandidates?.length ?? 0,
    bestCandidateScore: result.diagnostics.lineCandidates?.[0]?.score ?? null,
    edgeStrength: result.diagnostics.edgeStrength,
    fusionConfidence: result.diagnostics.fusion?.confidence ?? null,
    fusionSource: result.diagnostics.fusion?.source ?? null,
    stageCount: result.diagnostics.stages.length,
  };
}

function renderOverlaySvg(args: {
  imagePath: string;
  imageBytes: Uint8Array;
  result: PipelineOutput;
}, record: OverlayHarnessRecord): string {
  const dimensions = readImageDimensions(args.imageBytes) ?? dimensionsFromResult(args.result);
  const href = pathToFileURL(resolve(args.imagePath)).toString();
  const candidates = args.result.diagnostics.lineCandidates ?? [];
  const selectedY = args.result.diagnostics.meniscusY;
  const bottleRect = args.result.diagnostics.bottleRect;
  const candidateLines = candidates.map((candidate, index) => {
    const selected = selectedY !== null && Math.abs(candidate.y - selectedY) < 1;
    const color = selected || index === 0 ? "#ef4444" : index === 1 ? "#f59e0b" : "#22c55e";
    const width = selected || index === 0 ? 4 : 2;
    const x1 = bottleRect?.x ?? 0;
    const x2 = bottleRect ? bottleRect.x + bottleRect.w : dimensions.width;
    return `<line x1="${x1}" y1="${candidate.y}" x2="${x2}" y2="${candidate.y}" stroke="${color}" stroke-width="${width}" opacity="0.95"><title>${escapeXml(candidate.id)} score=${candidate.score} ${escapeXml(candidate.reason)}</title></line>`;
  }).join("\n  ");
  const rect = bottleRect
    ? `<rect x="${bottleRect.x}" y="${bottleRect.y}" width="${bottleRect.w}" height="${bottleRect.h}" fill="none" stroke="#06b6d4" stroke-width="3" opacity="0.9" />`
    : "";
  const label = [
    `gt=${record.groundTruthMl}ml`,
    `pred=${record.predictedMl ?? "ERR"}ml`,
    `err=${record.absErrorMl ?? "ERR"}ml`,
    `state=${record.stageMetrics.measurementState ?? "unknown"}`,
  ].join(" ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimensions.width} ${dimensions.height}" width="${dimensions.width}" height="${dimensions.height}">
  <image href="${href}" x="0" y="0" width="${dimensions.width}" height="${dimensions.height}" preserveAspectRatio="none" />
  ${rect}
  ${candidateLines}
  <rect x="12" y="12" width="${Math.min(dimensions.width - 24, 680)}" height="34" fill="rgba(0,0,0,0.68)" rx="4" />
  <text x="24" y="35" font-family="Arial, sans-serif" font-size="18" fill="#fff">${escapeXml(label)}</text>
</svg>
`;
}

function readImageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return {
      width: readUint32(bytes, 16),
      height: readUint32(bytes, 20),
    };
  }

  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) return null;
      const marker = bytes[offset + 1];
      const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
      if (length < 2) return null;
      if (marker >= 0xc0 && marker <= 0xc3) {
        return {
          height: (bytes[offset + 5] << 8) + bytes[offset + 6],
          width: (bytes[offset + 7] << 8) + bytes[offset + 8],
        };
      }
      offset += 2 + length;
    }
  }

  return null;
}

function dimensionsFromResult(result: PipelineOutput): { width: number; height: number } {
  const rect = result.diagnostics.bottleRect;
  if (!rect) return { width: 1000, height: 1000 };
  return {
    width: Math.max(1000, Math.ceil(rect.x + rect.w + 40)),
    height: Math.max(1000, Math.ceil(rect.y + rect.h + 40)),
  };
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function sanitizeStem(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 100) || "overlay";
}

function escapeXml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
