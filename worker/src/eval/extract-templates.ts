#!/usr/bin/env tsx
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const outDir = resolve(repoRoot, "worker/src/cv/templates");
await mkdir(outDir, { recursive: true });

const sources = [
  { path: "oil-bottle-frames/440ml/440ml_t0008.01s_f0016.jpg", x: 215, y: 50, w: 100, h: 370 },
  { path: "oil-bottle-frames/605ml/605ml_t0004.50s_f0009.jpg", x: 200, y: 40, w: 110, h: 380 },
  { path: "oil-bottle-frames/880ml/880ml_t0032.53s_f0065.jpg", x: 190, y: 60, w: 120, h: 360 },
];

for (let i = 0; i < sources.length; i++) {
  const { path, x, y, w, h } = sources[i];
  const imgPath = resolve(repoRoot, path);

  // Extract ROI using sharp, convert to grayscale, resize to template size
  // NOTE: sharp was removed to ensure Worker compatibility (it's a native addon).
  // If you need to re-run this, use a non-native alternative or run in a separate package.
  throw new Error("sharp was removed for Worker compatibility. extract-templates.ts needs migration to a JS-only image library.");
  /*
  const { data } = await sharp(imgPath)
    .extract({ left: x, top: y, width: w, height: h })
    .resize(80, 320, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  */

  // Save raw pixel data as base64
  const base64 = data.toString("base64");

  await writeFile(join(outDir, `template-${i}.json`), JSON.stringify({
    width: 80, height: 320, data: base64, source: path
  }));

  console.log(`Extracted template ${i}: ${path} (${data.length} bytes)`);
}

console.log(`Done — ${sources.length} templates to ${outDir}`);
