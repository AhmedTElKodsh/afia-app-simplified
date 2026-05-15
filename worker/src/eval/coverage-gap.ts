#!/usr/bin/env tsx
/**
 * Coverage-gap analysis: farthest-point sampling to find the 10 images
 * from the 870+ image corpus that are most dissimilar from the existing
 * 20 edge-case fixtures.
 *
 * Usage:
 *   tsx src/eval/coverage-gap.ts
 *
 * Output:
 *   - stdout: JSON array of 10 candidate fixture entries
 *   - runs/coverage-gap/candidates.json: per-candidate feature vectors
 */

import cv from "@techstark/opencv-js";
import { decode as decodeJpeg } from "jpeg-js";
import { PNG } from "pngjs";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { extname, join, resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

// ── Configuration ──

const MANIFEST_PATH = resolve(repoRoot, "worker/test/fixtures/cv-edge-eval/manifest.json");
const FRAMES_ROOT = resolve(repoRoot, "oil-bottle-frames");
const OUTPUT_DIR = resolve(repoRoot, "runs/coverage-gap");
const OUTPUT_PATH = join(OUTPUT_DIR, "candidates.json");
const SELECT_COUNT = 10;

const FEATURE_NAMES = ["brightness", "contrast", "edge", "blur", "reflection"];
const BRIGHTNESS = 0;
const CONTRAST = 1;
const EDGE_DENSITY = 2;
const BLUR = 3;
const REFLECTION = 4;

// ── Utility functions ──

function groundTruthMlFromPath(imagePath: string): number {
  const match = imagePath.match(/[\\/](\d+ml|empty)[\\/]/i);
  if (!match) {
    throw new Error(`Cannot infer ground truth ml from path: ${imagePath}`);
  }
  if (match[1].toLowerCase() === "empty") return 0;
  return parseInt(match[1], 10);
}

function fillBucket(ml: number): string {
  if (ml <= 330) return "empty-low";
  if (ml <= 660) return "mid-low";
  if (ml <= 990) return "mid-high";
  return "high";
}

function stratumFor(fillBucket: string): string {
  return `real:${fillBucket}:edge`;
}

function mimeType(buf: Uint8Array): string {
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
    return "image/webp";
  }
  return "image/jpeg";
}

function decodeImage(buf: Uint8Array): { data: Uint8Array; width: number; height: number } {
  const mime = mimeType(buf);

  if (mime === "image/jpeg") {
    const decoded = decodeJpeg(buf, { useTArray: true });
    return { data: new Uint8Array(decoded.data), width: decoded.width, height: decoded.height };
  }

  if (mime === "image/png") {
    const decoded = PNG.sync.read(Buffer.from(buf));
    return {
      data: new Uint8Array(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength),
      width: decoded.width,
      height: decoded.height,
    };
  }

  // Fallback: try JPEG
  const decoded = decodeJpeg(buf, { useTArray: true });
  return { data: new Uint8Array(decoded.data), width: decoded.width, height: decoded.height };
}

// ── Image listing ──

async function listImages(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listImages(path)));
    } else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

// ── Feature extraction ──

interface FeatureVector {
  brightness: number;   // mean grayscale (0-255)
  contrast: number;     // std dev of grayscale (0-255)
  edgeDensity: number;  // ratio of Canny edge pixels to total (0-1)
  blur: number;         // variance of Laplacian (0-∞, lower = more blurry)
  reflection: number;   // mid-freq energy concentration in upper third (0-1)
}

function computeSobelMagnitudeSkew(gradMag: any): number {
  // Compute histogram of gradient magnitudes in upper third
  const data = gradMag.data64F;
  if (!data || data.length === 0) return 0;

  // Build a histogram with 32 bins
  const bins = 32;
  const hist = new Array(bins).fill(0);
  let maxVal = 0;
  for (let i = 0; i < data.length; i++) {
    const v = Math.abs(data[i]);
    if (v > maxVal) maxVal = v;
  }
  if (maxVal < 1e-6) return 0;

  const binScale = bins / maxVal;
  for (let i = 0; i < data.length; i++) {
    const bin = Math.min(bins - 1, Math.floor(Math.abs(data[i]) * binScale));
    hist[bin]++;
  }

  // Compute skew as the concentration in mid-frequency bins (bins 8-23)
  const total = data.length;
  const midFreq = hist.slice(8, 24).reduce((s, c) => s + c, 0);
  return midFreq / total;
}

async function extractFeatures(cv: any, imagePath: string): Promise<FeatureVector> {
  const buf = await readFile(imagePath);
  const { data, width, height } = decodeImage(buf);

  const imageDataObj = {
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    width,
    height,
  };

  const src = cv.matFromImageData(imageDataObj);
  const gray = new cv.Mat();
  const finalize = () => {
    src.delete();
    gray.delete();
  };

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // 1. Brightness & Contrast: mean + std dev of grayscale
    const meanMat = new cv.Mat();
    const stdDevMat = new cv.Mat();
    cv.meanStdDev(gray, meanMat, stdDevMat);
    const brightness = meanMat.data64F[0];
    const contrast = stdDevMat.data64F[0];
    meanMat.delete();
    stdDevMat.delete();

    const totalPixels = gray.rows * gray.cols;

    // 2. Edge density: Canny edge pixel ratio
    const edges = new cv.Mat();
    cv.Canny(gray, edges, 50, 150, 3, false);
    const edgePixels = cv.countNonZero(edges);
    const edgeDensity = totalPixels > 0 ? edgePixels / totalPixels : 0;
    edges.delete();

    // 3. Blur: variance of Laplacian
    const lap = new cv.Mat();
    cv.Laplacian(gray, lap, cv.CV_64F, 3, 1, 0, cv.BORDER_DEFAULT);
    const lapMean = new cv.Mat();
    const lapStdDev = new cv.Mat();
    cv.meanStdDev(lap, lapMean, lapStdDev);
    const blurVariance = lapStdDev.data64F[0] * lapStdDev.data64F[0];
    lap.delete();
    lapMean.delete();
    lapStdDev.delete();

    // 4. Reflection proxy: Sobel gradient energy in upper third
    const thirdH = Math.max(1, Math.floor(gray.rows / 3));
    const upperRoi = gray.roi(new cv.Rect(0, 0, gray.cols, thirdH));
    const sobelX = new cv.Mat();
    const sobelY = new cv.Mat();
    cv.Sobel(upperRoi, sobelX, cv.CV_64F, 1, 0, 3);
    cv.Sobel(upperRoi, sobelY, cv.CV_64F, 0, 1, 3);
    const gradMag = new cv.Mat();
    cv.magnitude(sobelX, sobelY, gradMag);
    const reflection = computeSobelMagnitudeSkew(gradMag);
    upperRoi.delete();
    sobelX.delete();
    sobelY.delete();
    gradMag.delete();

    return { brightness, contrast, edgeDensity, blur: blurVariance, reflection };
  } finally {
    finalize();
  }
}

// ── Min-max normalization ──

function normalize(vectors: number[][]): number[][] {
  const dims = vectors[0].length;
  const mins = new Array(dims).fill(Infinity);
  const maxs = new Array(dims).fill(-Infinity);

  for (const v of vectors) {
    for (let d = 0; d < dims; d++) {
      if (v[d] < mins[d]) mins[d] = v[d];
      if (v[d] > maxs[d]) maxs[d] = v[d];
    }
  }

  return vectors.map((v) =>
    v.map((val, d) => {
      const range = maxs[d] - mins[d];
      return range > 1e-10 ? (val - mins[d]) / range : 0.5;
    })
  );
}

// ── Distance & selection ──

function euclidean(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function perFeatureDistance(a: number[], b: number[]): number[] {
  return a.map((val, i) => Math.abs(val - b[i]));
}

/**
 * Greedy farthest-point sampling.
 * - `existing`: feature vectors of already-selected points (N x D)
 * - `candidates`: feature vectors of remaining candidates (M x D)
 * Returns array of indices into the candidate list, in selection order.
 */
function farthestPointSampling(
  existing: number[][],
  candidates: number[][],
  selectCount: number
): Array<{ index: number; drivingFeature: number }> {
  const selected: Array<{ index: number; drivingFeature: number }> = [];
  const allPoints = [...existing]; // grows as we add selected candidates

  // Precompute min distances from each candidate to existing set
  const minDistances: number[] = candidates.map((c) => {
    let minDist = Infinity;
    for (const e of existing) {
      const d = euclidean(c, e);
      if (d < minDist) minDist = d;
    }
    return minDist;
  });

  for (let round = 0; round < selectCount; round++) {
    // Find the candidate with the largest minimum distance
    let bestIdx = -1;
    let bestDist = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      if (minDistances[i] < 0) continue; // already selected
      if (minDistances[i] > bestDist) {
        bestDist = minDistances[i];
        bestIdx = i;
      }
    }

    if (bestIdx < 0) break; // no more candidates

    // Determine which feature drove this selection
    const candidateVector = candidates[bestIdx];
    let perFeatMin = Infinity;
    let drivingFeature = 0;
    for (const e of allPoints) {
      const pfd = perFeatureDistance(candidateVector, e);
      for (let d = 0; d < pfd.length; d++) {
        if (pfd[d] < perFeatMin) {
          perFeatMin = pfd[d];
          drivingFeature = d;
        }
      }
    }

    selected.push({ index: bestIdx, drivingFeature });

    // Mark as selected (negative distance)
    minDistances[bestIdx] = -1;

    // Add to allPoints for future distance calculations
    allPoints.push(candidates[bestIdx]);

    // Update min distances for remaining candidates
    for (let i = 0; i < candidates.length; i++) {
      if (minDistances[i] < 0) continue;
      const d = euclidean(candidates[i], candidates[bestIdx]);
      if (d < minDistances[i]) {
        minDistances[i] = d;
      }
    }
  }

  return selected;
}

// ── Main ──

async function waitForCv(maxWaitMs = 30000): Promise<void> {
  const pollInterval = 200;
  const attempts = Math.ceil(maxWaitMs / pollInterval);
  for (let i = 0; i < attempts; i++) {
    if (typeof cv.Mat === "function") return;
    await new Promise((r) => setTimeout(r, pollInterval));
  }
  throw new Error(
    "OpenCV.js failed to initialize within timeout — cv.Mat not constructable. " +
      "Verify @techstark/opencv-js is installed."
  );
}

async function main(): Promise<void> {
  // 1. Wait for OpenCV.js WASM to initialize
  await waitForCv();

  // 2. Check corpus exists
  if (!existsSync(FRAMES_ROOT)) {
    console.error(`Error: oil-bottle-frames corpus not found at: ${FRAMES_ROOT}`);
    console.error("Expected path:", FRAMES_ROOT);
    console.error(
      "The 870+ image corpus must be available on disk. " +
        "If missing, download or generate the corpus first."
    );
    process.exit(1);
  }

  // 3. Load existing manifest (read-only)
  let manifest: any;
  try {
    const manifestContent = await readFile(MANIFEST_PATH, "utf8");
    manifest = JSON.parse(manifestContent);
  } catch (err) {
    console.error(
      `Error: Failed to read or parse manifest at ${MANIFEST_PATH}:`,
      (err as Error).message
    );
    process.exit(1);
  }

  const existingFixtures = manifest.fixtures as Array<{ imagePath: string; groundTruthMl: number }>;
  const existingPaths = new Set(existingFixtures.map((f) => f.imagePath));
  console.log(`Loaded ${existingFixtures.length} existing edge-case fixtures`);

  // 4. List all images in the corpus
  console.log(`Scanning ${FRAMES_ROOT}...`);
  let allImages: string[];
  try {
    allImages = await listImages(FRAMES_ROOT);
  } catch (err) {
    console.error(
      `Error: Failed to scan ${FRAMES_ROOT}:`,
      (err as Error).message
    );
    process.exit(1);
  }

  console.log(`Found ${allImages.length} images in corpus`);

  // 5. Filter out existing fixture paths and non-standard directories
  const candidates = allImages.filter((imgPath) => {
    const relPath = relative(repoRoot, imgPath).replace(/\\/g, "/");
    // Skip existing fixtures
    if (existingPaths.has(relPath)) return false;
    // Skip non-standard directories (e.g. 1.5L_refs, root-level files)
    const dirMatch = relPath.match(/oil-bottle-frames\/(\d+ml|empty)\//i);
    if (!dirMatch) return false;
    return true;
  });

  console.log(`${candidates.length} candidate images after filtering`);

  if (candidates.length < SELECT_COUNT) {
    console.error(
      `Error: Only ${candidates.length} candidates available, need ${SELECT_COUNT}.`
    );
    process.exit(1);
  }

  // 6. Extract feature vectors for existing fixtures
  console.log("Extracting features for existing fixtures...");
  const existingFeatures: number[][] = [];
  for (let i = 0; i < existingFixtures.length; i++) {
    const fx = existingFixtures[i];
    const absPath = resolve(repoRoot, fx.imagePath);
    if (!existsSync(absPath)) {
      console.warn(`  [${i + 1}/${existingFixtures.length}] SKIP (not found): ${fx.imagePath}`);
      continue;
    }
    try {
      const feat = await extractFeatures(cv, absPath);
      existingFeatures.push([feat.brightness, feat.contrast, feat.edgeDensity, feat.blur, feat.reflection]);
      console.log(`  [${i + 1}/${existingFixtures.length}] ${fx.imagePath.split("/").pop()}`);
    } catch (err) {
      console.warn(`  [${i + 1}/${existingFixtures.length}] ERROR: ${fx.imagePath} - ${(err as Error).message}`);
    }
  }

  if (existingFeatures.length === 0) {
    console.error("Error: Could not extract features from any existing fixture.");
    process.exit(1);
  }
  console.log(`Extracted features for ${existingFeatures.length} existing fixtures`);

  // 7. Extract feature vectors for candidates
  console.log("Extracting features for candidate images...");
  const candidateFeatures: number[][] = [];
  const candidatePaths: string[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const absPath = candidates[i];
    const relPath = relative(repoRoot, absPath).replace(/\\/g, "/");
    try {
      const feat = await extractFeatures(cv, absPath);
      candidateFeatures.push([feat.brightness, feat.contrast, feat.edgeDensity, feat.blur, feat.reflection]);
      candidatePaths.push(relPath);
    } catch (err) {
      console.warn(`  [${i + 1}/${candidates.length}] ERROR: ${relPath} - ${(err as Error).message}`);
    }

    if ((i + 1) % 100 === 0 || i === candidates.length - 1) {
      console.log(`  Feature extraction: ${i + 1}/${candidates.length} (${candidateFeatures.length} valid)`);
    }
  }

  if (candidateFeatures.length < SELECT_COUNT) {
    console.error(
      `Error: Only ${candidateFeatures.length} viable candidates after extraction, need ${SELECT_COUNT}.`
    );
    process.exit(1);
  }

  // 8. Normalize
  const allVectors = [...existingFeatures, ...candidateFeatures];
  const normalized = normalize(allVectors);
  const normalizedExisting = normalized.slice(0, existingFeatures.length);
  const normalizedCandidates = normalized.slice(existingFeatures.length);

  // 9. Farthest-point sampling
  console.log("\nRunning farthest-point sampling...");
  const selections = farthestPointSampling(normalizedExisting, normalizedCandidates, SELECT_COUNT);
  console.log(`Selected ${selections.length} candidates\n`);

  // 10. Build output
  const outputEntries: Array<{
    imagePath: string;
    groundTruthMl: number;
    reason: string;
    source: string;
    fillBucket: string;
    stratum: string;
    imageId: string;
    featureVector: number[];
    distanceScore: number;
  }> = [];

  for (const sel of selections) {
    const absPath = candidates[sel.index];
    const relPath = relative(repoRoot, absPath).replace(/\\/g, "/");
    const ml = groundTruthMlFromPath(relPath);
    const fb = fillBucket(ml);
    const featName = FEATURE_NAMES[sel.drivingFeature];
    const reason = `gap_${featName}`;
    const imageId = `edge-gap_${featName}`;

    // Compute distance score (min distance to existing + selected set)
    let minDist = Infinity;
    for (const e of normalizedExisting) {
      const d = euclidean(normalizedCandidates[sel.index], e);
      if (d < minDist) minDist = d;
    }

    outputEntries.push({
      imagePath: relPath,
      groundTruthMl: ml,
      reason,
      source: "real",
      fillBucket: fb,
      stratum: stratumFor(fb),
      imageId,
      featureVector: candidateFeatures[sel.index],
      distanceScore: minDist,
    });
  }

  // 11. Write output
  const cleanEntries = outputEntries.map(({ featureVector, distanceScore, ...rest }) => rest);

  // stdout: JSON array of candidate entries
  console.log("\n=== Selected candidates ===");
  console.log(JSON.stringify(cleanEntries, null, 2));

  // Write detailed output to runs/coverage-gap/
  await mkdir(OUTPUT_DIR, { recursive: true });
  const detailOutput = {
    runDate: new Date().toISOString(),
    selectCount: SELECT_COUNT,
    existingCount: existingFeatures.length,
    candidateCount: candidateFeatures.length,
    selections: outputEntries.map((e) => ({
      ...e,
      candidateIndex: selections.find((s) => s.index === candidatePaths.indexOf(e.imagePath))?.index ?? -1,
    })),
  };
  await writeFile(OUTPUT_PATH, JSON.stringify(detailOutput, null, 2));
  console.log(`\nDetailed output written to: ${OUTPUT_PATH}`);

  // 12. Validate
  for (const entry of cleanEntries) {
    if (typeof entry.groundTruthMl !== "number") {
      console.error(`Validation error: groundTruthMl missing for ${entry.imagePath}`);
      process.exit(1);
    }
    if (!entry.imageId.startsWith("edge-")) {
      console.error(`Validation error: imageId must start with 'edge-' for ${entry.imagePath}`);
      process.exit(1);
    }
  }

  console.log("\nCoverage-gap analysis complete. 10 candidates ready for manifest update.");
}

main().catch((err) => {
  console.error("Coverage-gap analysis failed:", err);
  process.exit(1);
});
