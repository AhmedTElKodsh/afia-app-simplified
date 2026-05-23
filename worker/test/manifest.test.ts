import { describe, expect, it } from "vitest";
import { fillBucket, sampleManifest } from "../src/eval/manifest.js";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

describe("fillBucket", () => {
  it("buckets ml correctly", () => {
    expect(fillBucket(0)).toBe("empty-low");
    expect(fillBucket(275)).toBe("empty-low");
    expect(fillBucket(330)).toBe("mid-low");
    expect(fillBucket(770)).toBe("mid-low");
    expect(fillBucket(825)).toBe("mid-high");
    expect(fillBucket(1265)).toBe("high");
    expect(fillBucket(1500)).toBe("high");
  });
});

describe("sampleManifest", () => {
  it("produces deterministic sample for fixed seed", async () => {
    const roots = await fixtureRoots("deterministic");
    const a = await sampleManifest({ devCount: 4, holdoutCount: 2, seed: 42, ...roots });
    const b = await sampleManifest({ devCount: 4, holdoutCount: 2, seed: 42, ...roots });
    expect(a.dev.map((f) => f.imageId)).toEqual(b.dev.map((f) => f.imageId));
    expect(a.holdout.map((f) => f.imageId)).toEqual(b.holdout.map((f) => f.imageId));
  });

  it("dev and holdout are disjoint", async () => {
    const roots = await fixtureRoots("disjoint");
    const m = await sampleManifest({ devCount: 4, holdoutCount: 2, seed: 42, ...roots });
    const devSet = new Set(m.dev.map((f) => f.imageId));
    for (const h of m.holdout) expect(devSet.has(h.imageId)).toBe(false);
  });

  it("excludes non_eligable and non_eligible folders from model manifests", async () => {
    const roots = await fixtureRoots("eligibility");
    await writeImage(join(roots.framesRoot, "715ml", "non_eligable", "bad-real.jpg"));
    await writeImage(join(roots.augRoot, "825ml", "non_eligible", "bad-aug.jpg"));

    const m = await sampleManifest({ devCount: 10, holdoutCount: 10, seed: 7, ...roots });
    const imageIds = [...m.dev, ...m.holdout].map((f) => f.imageId);

    expect(imageIds.length).toBeGreaterThan(0);
    expect(imageIds.some((id) => id.includes("non_eligable") || id.includes("non_eligible"))).toBe(false);
    expect(m.cellCounts["real:mid-low:early"]).toBeGreaterThan(0);
    expect(m.cellCounts["aug:mid-high:aug"]).toBeGreaterThan(0);
  });
});

async function fixtureRoots(name: string): Promise<{ framesRoot: string; augRoot: string }> {
  const root = join(tmpdir(), `afia-manifest-${name}-${process.pid}-${Math.random().toString(16).slice(2)}`);
  const framesRoot = join(root, "oil-bottle-frames");
  const augRoot = join(root, "oil-bottle-augmented");
  await writeImage(join(framesRoot, "715ml", "715ml_t0001.00s_f0002.jpg"));
  await writeImage(join(framesRoot, "715ml", "715ml_t0007.00s_f0014.jpg"));
  await writeImage(join(framesRoot, "825ml", "825ml_t0001.00s_f0002.jpg"));
  await writeImage(join(augRoot, "825ml", "aug-825ml-0001.jpg"));
  await writeImage(join(augRoot, "1265ml", "aug-1265ml-0001.jpg"));
  await writeImage(join(augRoot, "empty", "aug-empty-0001.jpg"));
  return { framesRoot, augRoot };
}

async function writeImage(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, "fake image");
}
