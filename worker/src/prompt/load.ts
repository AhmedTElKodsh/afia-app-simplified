import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

// Skip fileURLToPath in Workers environment
let baseDir: string;
if (typeof process !== "undefined" && process.env) {
  try {
    const { fileURLToPath } = await import("node:url");
    baseDir = dirname(fileURLToPath(import.meta.url));
  } catch {
    baseDir = "src/prompt";
  }
} else {
  baseDir = "src/prompt";
}

export interface FewShot {
  imagePath: string;
  expected: {
    readingPossible: boolean;
    meniscusVisible: "yes" | "no" | "uncertain";
    oilSurfaceYRatio: number;
    nearestReferenceMl: number;
    qualityFlags: string[];
    confidence: number;
  };
}

export interface FewShotManifestEntry {
  path: string;
  role: "anchor" | "golden";
  remainingMl: number;
}

interface FewShotManifest {
  version: string;
  description?: string;
  entries: FewShotManifestEntry[];
}

export interface LoadedPrompt {
  systemText: string;
  userText: string;
  fewShots: FewShot[];
  promptHash: string;
  fewshotHash: string;
  promptVersion: string;
  fewShotManifest: FewShotManifestEntry[];
}

function hash16(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

export async function loadPrompt(version: string): Promise<LoadedPrompt> {
  const root = join(baseDir, version);
  const systemText = await readFile(join(root, "system.md"), "utf8");
  const userText = await readFile(join(root, "bottle-reference.md"), "utf8");
  const fewshotDir = join(root, "few-shots");
  const manifest = JSON.parse(await readFile(join(fewshotDir, "manifest.json"), "utf8")) as FewShotManifest;
  if (manifest.version !== version) {
    throw new Error(`Few-shot manifest version ${manifest.version} does not match prompt version ${version}`);
  }
  const fewShots: FewShot[] = [];
  for (const entry of manifest.entries) {
    fewShots.push(JSON.parse(await readFile(join(fewshotDir, entry.path), "utf8")));
  }
  return {
    systemText,
    userText,
    fewShots,
    promptHash: hash16(systemText + "\n---\n" + userText),
    fewshotHash: hash16(JSON.stringify({ entries: manifest.entries, fewShots })),
    promptVersion: version,
    fewShotManifest: manifest.entries,
  };
}
