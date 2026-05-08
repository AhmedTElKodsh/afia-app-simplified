import { describe, expect, it } from "vitest";
import { fillBucket, sampleManifest } from "../src/eval/manifest.js";

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
    const a = await sampleManifest({ devCount: 60, holdoutCount: 40, seed: 42, framesRoot: "oil-bottle-frames", augRoot: "oil-bottle-augmented" });
    const b = await sampleManifest({ devCount: 60, holdoutCount: 40, seed: 42, framesRoot: "oil-bottle-frames", augRoot: "oil-bottle-augmented" });
    expect(a.dev.map((f) => f.imageId)).toEqual(b.dev.map((f) => f.imageId));
    expect(a.holdout.map((f) => f.imageId)).toEqual(b.holdout.map((f) => f.imageId));
  });

  it("dev and holdout are disjoint", async () => {
    const m = await sampleManifest({ devCount: 60, holdoutCount: 40, seed: 42, framesRoot: "oil-bottle-frames", augRoot: "oil-bottle-augmented" });
    const devSet = new Set(m.dev.map((f) => f.imageId));
    for (const h of m.holdout) expect(devSet.has(h.imageId)).toBe(false);
  });
});
