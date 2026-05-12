import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

export interface LoadedPrompt {
  systemText: string;
  userText: string;
  fewShots: FewShot[];
  promptHash: string;
  fewshotHash: string;
  promptVersion: string;
}

function hash16(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

export async function loadPrompt(version: string): Promise<LoadedPrompt> {
  const root = join(__dirname, version);
  const systemText = await readFile(join(root, "system.md"), "utf8");
  const userText = await readFile(join(root, "bottle-reference.md"), "utf8");
  const fewshotDir = join(root, "few-shots");
  const files = (await readdir(fewshotDir)).filter((f) => f.endsWith(".json")).sort();
  const fewShots: FewShot[] = [];
  for (const f of files) fewShots.push(JSON.parse(await readFile(join(fewshotDir, f), "utf8")));
  return {
    systemText,
    userText,
    fewShots,
    promptHash: hash16(systemText + "\n---\n" + userText),
    fewshotHash: hash16(JSON.stringify(fewShots)),
    promptVersion: version,
  };
}
