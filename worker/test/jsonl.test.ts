import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeRunRecord } from "../src/eval/jsonl.js";
import type { RunRecord } from "@afia/shared";

describe("writeRunRecord", () => {
  it("appends one line of valid JSON per call", async () => {
    const dir = mkdtempSync(join(tmpdir(), "afia-jsonl-"));
    const path = join(dir, "run.jsonl");
    const rec: RunRecord = {
      runId: "r1", runStartedTs: "2026-05-07T00:00:00Z",
      promptHash: "a".repeat(16), fewshotHash: "b".repeat(16),
      modelId: "gemini-2.5-flash", modelVersion: "v1",
      imageId: "x.jpg", imagePath: "/x.jpg", stratum: "real:high:early",
      groundTruthMl: 1500, rawOutput: "{}", parsedMl: 1485, parsedConfidence: 0.9,
      absErrorMl: 15, exactBucketPass: true, closeBucketPass: true,
      comparatorName: "ml-bucket-tolerance", comparatorVersion: "1.0.0",
      holdoutTouches: 0,
    };
    await writeRunRecord(path, rec);
    await writeRunRecord(path, rec);
    const lines = readFileSync(path, "utf8").trim().split("\n");
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).imageId).toBe("x.jpg");
  });
});
