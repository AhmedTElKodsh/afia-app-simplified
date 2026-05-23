import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const INELIGIBLE_DIR_NAMES = new Set(["non_eligable", "non_eligible"]);

export type Source = "real" | "aug";
export type FillBucket = "empty-low" | "mid-low" | "mid-high" | "high";
export type FrameBucket = "early" | "late" | "aug";

export interface FixtureEntry {
  imageId: string;
  imagePath: string;
  groundTruthMl: number;
  source: Source;
  fillBucket: FillBucket;
  frameBucket: FrameBucket;
  stratum: string;
}

export interface SampleArgs {
  devCount: number;
  holdoutCount: number;
  seed: number;
  framesRoot: string;
  augRoot: string;
}

export interface SampledManifest {
  dev: FixtureEntry[];
  holdout: FixtureEntry[];
  cellCounts: Record<string, number>;
  seed: number;
}

export function fillBucket(ml: number): FillBucket {
  if (ml <= 275) return "empty-low";
  if (ml <= 770) return "mid-low";
  if (ml <= 1210) return "mid-high";
  return "high";
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parseMlFolder(name: string): number | null {
  if (name === "empty") return 0;
  const m = name.match(/^(\d+)ml$/);
  return m ? parseInt(m[1], 10) : null;
}

function parseFrameSeconds(filename: string): number | null {
  const m = filename.match(/_t(\d+)\.(\d+)s_/);
  if (!m) return null;
  return parseInt(m[1], 10) + parseInt(m[2], 10) / 100;
}

async function listFixtures(root: string, source: Source): Promise<FixtureEntry[]> {
  const out: FixtureEntry[] = [];
  let folders: Awaited<ReturnType<typeof readdir>>;
  try { folders = await readdir(root, { withFileTypes: true }); }
  catch { return out; }
  for (const folder of folders) {
    if (!folder.isDirectory()) continue;
    if (INELIGIBLE_DIR_NAMES.has(folder.name.toLowerCase())) continue;
    const ml = parseMlFolder(folder.name);
    if (ml === null) continue;
    const folderPath = join(root, folder.name);
    let files: string[];
    try { files = await readdir(folderPath); }
    catch { continue; }
    for (const f of files) {
      if (INELIGIBLE_DIR_NAMES.has(f.toLowerCase())) continue;
      if (!/\.(jpg|jpeg|png)$/i.test(f)) continue;
      const frameSec = source === "real" ? parseFrameSeconds(f) : null;
      const frameBucket: FrameBucket =
        source === "aug" ? "aug" : (frameSec !== null && frameSec < 5) ? "early" : "late";
      out.push({
        imageId: relative(process.cwd(), join(folderPath, f)).replace(/\\/g, "/"),
        imagePath: join(folderPath, f),
        groundTruthMl: ml,
        source,
        fillBucket: fillBucket(ml),
        frameBucket,
        stratum: `${source}:${fillBucket(ml)}:${frameBucket}`,
      });
    }
  }
  return out;
}

export async function sampleManifest(args: SampleArgs): Promise<SampledManifest> {
  const real = await listFixtures(args.framesRoot, "real");
  const aug = await listFixtures(args.augRoot, "aug");
  const all = [...real, ...aug];
  const rand = rng(args.seed);

  const byStratum = new Map<string, FixtureEntry[]>();
  for (const f of all) {
    if (!byStratum.has(f.stratum)) byStratum.set(f.stratum, []);
    byStratum.get(f.stratum)!.push(f);
  }
  const cellCounts: Record<string, number> = {};
  for (const [k, v] of byStratum) cellCounts[k] = v.length;

  const strata = Array.from(byStratum.keys()).sort();
  for (const k of strata) byStratum.set(k, shuffle(byStratum.get(k)!, rand));

  const dev: FixtureEntry[] = [];
  const holdout: FixtureEntry[] = [];

  outer: while (dev.length < args.devCount || holdout.length < args.holdoutCount) {
    let progressed = false;
    for (const k of strata) {
      const pool = byStratum.get(k)!;
      if (dev.length < args.devCount && pool.length > 0) {
        dev.push(pool.shift()!);
        progressed = true;
        if (dev.length >= args.devCount && holdout.length >= args.holdoutCount) break outer;
      }
      if (holdout.length < args.holdoutCount && pool.length > 0) {
        holdout.push(pool.shift()!);
        progressed = true;
        if (dev.length >= args.devCount && holdout.length >= args.holdoutCount) break outer;
      }
    }
    if (!progressed) break;
  }

  return { dev, holdout, cellCounts, seed: args.seed };
}
