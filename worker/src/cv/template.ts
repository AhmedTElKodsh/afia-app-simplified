import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { cv, ensureCv } from "./index.js";

// Skip fileURLToPath in Workers environment
let templatesDir: string;
if (typeof process !== "undefined" && process.env) {
  try {
    const { fileURLToPath } = await import("node:url");
    const __dirname = dirname(fileURLToPath(import.meta.url));
    templatesDir = join(__dirname, "templates");
  } catch {
    templatesDir = "src/cv/templates";
  }
} else {
  templatesDir = "src/cv/templates";
}

export interface TemplateMatch {
  found: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
}

let templates: any[] = [];
let loaded = false;

/**
 * Load real bottle templates extracted from known-good images.
 * Templates are 80×320 grayscale crops saved as base64 pixel data.
 */
export async function initTemplates(): Promise<void> {
  if (loaded) return;
  await ensureCv();

  let files: string[];
  try {
    files = (await readdir(templatesDir)).filter((f) => f.endsWith(".json")).sort();
  } catch {
    console.warn("[templates] No template directory found — skipping");
    loaded = true;
    return;
  }

  for (const file of files) {
    try {
      const content = JSON.parse(await readFile(join(templatesDir, file), "utf8"));
      const { width, height, data: base64 } = content;
      const pixels = Buffer.from(base64, "base64");

      // Create OpenCV mat from pixel data
      const mat = cv.matFromArray(height, width, cv.CV_8UC1, Array.from(pixels));

      // CLAHE to match pipeline preprocessing
      const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
      const equalized = new cv.Mat();
      clahe.apply(mat, equalized);
      clahe.delete();

      templates.push(equalized);
      mat.delete();
    } catch (e) {
      console.warn(`[templates] Failed to load ${file}: ${(e as Error).message}`);
    }
  }

  loaded = true;
  console.log(`[templates] Loaded ${templates.length} real bottle templates`);
}

export function matchBottle(
  equalized: any,
  threshold = 0.3,
): TemplateMatch | null {
  if (templates.length === 0) return null;

  let bestMatch: TemplateMatch | null = null;

  for (const template of templates) {
    for (const scale of [0.8, 1.0, 1.2]) {
      const scaledW = Math.round(template.cols * scale);
      const scaledH = Math.round(template.rows * scale);

      if (scaledW > equalized.cols || scaledH > equalized.rows) continue;

      const scaled = new cv.Mat();
      cv.resize(template, scaled, new cv.Size(scaledW, scaledH), 0, 0, cv.INTER_LINEAR);

      const result = new cv.Mat();
      cv.matchTemplate(equalized, scaled, result, cv.TM_CCOEFF_NORMED);

      const minMax = cv.minMaxLoc(result, null);
      const score = minMax.maxVal;

      if (score > threshold && (!bestMatch || score > bestMatch.score)) {
        bestMatch = {
          found: true,
          x: minMax.maxLoc.x,
          y: minMax.maxLoc.y,
          width: scaledW,
          height: scaledH,
          score,
        };
      }

      scaled.delete();
      result.delete();
    }
  }

  return bestMatch;
}

export function freeTemplates(): void {
  for (const t of templates) t.delete();
  templates = [];
  loaded = false;
}
