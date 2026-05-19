#!/usr/bin/env tsx
import { writeFile, mkdir } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

// Edge cases curated from known eval failures
// Each captures a different failure mode
const fixtures: any[] = [
  // EMPTY BOTTLES — commonly misread as full (glare/reflection)
  { imagePath: "oil-bottle-frames/empty/empty_t0065.05s_f0130.jpg", groundTruthMl: 0, reason: "empty_uniform_light" },
  { imagePath: "oil-bottle-frames/empty/empty_t0131.61s_f0263.jpg", groundTruthMl: 0, reason: "empty_dark_background" },
  { imagePath: "oil-bottle-frames/empty/empty_t0086.57s_f0173.jpg", groundTruthMl: 0, reason: "empty_side_light" },

  // LOW FILL — contour often misses meniscus near shoulder
  { imagePath: "oil-bottle-frames/55ml/55ml_t0000.00s_f0000.jpg", groundTruthMl: 55, reason: "low_meniscus_at_shoulder" },
  { imagePath: "oil-bottle-frames/55ml/55ml_t0009.10s_f0018.jpg", groundTruthMl: 55, reason: "low_dark_frame" },
  { imagePath: "oil-bottle-frames/110ml/110ml_t0008.51s_f0017.jpg", groundTruthMl: 110, reason: "low_overexposed" },
  { imagePath: "oil-bottle-frames/165ml/165ml_t0000.00s_f0000.jpg", groundTruthMl: 165, reason: "low_label_overlap" },

  // MID FILL — contour detection unreliable in linear range
  { imagePath: "oil-bottle-frames/495ml/495ml_t0027.04s_f0054.jpg", groundTruthMl: 495, reason: "mid_no_contour" },
  { imagePath: "oil-bottle-frames/660ml/660ml_t0006.50s_f0013.jpg", groundTruthMl: 660, reason: "mid_no_contour" },
  { imagePath: "oil-bottle-frames/770ml/770ml_t0010.01s_f0020.jpg", groundTruthMl: 770, reason: "mid_no_contour" },
  { imagePath: "oil-bottle-frames/825ml/825ml_t0002.50s_f0005.jpg", groundTruthMl: 825, reason: "mid_glare" },
  { imagePath: "oil-bottle-frames/880ml/880ml_t0038.54s_f0077.jpg", groundTruthMl: 880, reason: "mid_no_contour" },

  // HIGH FILL — meniscus near base, hard to distinguish
  { imagePath: "oil-bottle-frames/1100ml/1100ml_t0004.00s_f0008.jpg", groundTruthMl: 1100, reason: "high_no_contour" },
  { imagePath: "oil-bottle-frames/1265ml/1265ml_t0002.50s_f0005.jpg", groundTruthMl: 1265, reason: "high_no_contour" },
  { imagePath: "oil-bottle-frames/1430ml/1430ml_t0012.51s_f0025.jpg", groundTruthMl: 1430, reason: "high_no_contour" },

  // FULL BOTTLES
  { imagePath: "oil-bottle-frames/1500ml/1500ml_t0001.50s_f0003.jpg", groundTruthMl: 1500, reason: "full_shoulder_reflection" },
  { imagePath: "oil-bottle-frames/1500ml/1500ml_t0022.00s_f0044.jpg", groundTruthMl: 1500, reason: "full_dark" },

  // KNOWN GOOD DETECTIONS (for contrast)
  { imagePath: "oil-bottle-frames/440ml/440ml_t0008.01s_f0016.jpg", groundTruthMl: 440, reason: "known_good_detection" },
  { imagePath: "oil-bottle-frames/880ml/880ml_t0032.53s_f0065.jpg", groundTruthMl: 880, reason: "known_good_detection" },
  { imagePath: "oil-bottle-frames/1375ml/1375ml_t0041.06s_f0082.jpg", groundTruthMl: 1375, reason: "known_good_detection" },
];

for (const f of fixtures) {
  f.source = "real";
  f.fillBucket = f.groundTruthMl <= 330 ? "empty-low" : f.groundTruthMl <= 660 ? "mid-low" : f.groundTruthMl <= 990 ? "mid-high" : "high";
  f.stratum = `real:${f.fillBucket}:edge`;
  f.imageId = `edge-${f.reason}`;
}

const manifest = {
  name: "cv-edge-eval", why: "Curated edge cases covering failure modes: empty, low, mid, high, full, glare, dark",
  seed: Date.now(), fixtures,
};

const outDir = resolve(repoRoot, "worker/test/fixtures/cv-edge-eval");
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`Edge-case manifest: ${fixtures.length} fixtures`);
for (const f of fixtures) {
  console.log(`  ${f.imageId}: gt=${f.groundTruthMl}ml — ${f.reason}`);
}
