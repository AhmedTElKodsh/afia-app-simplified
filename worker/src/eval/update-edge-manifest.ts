#!/usr/bin/env tsx
/**
 * Task 2 helper: append coverage-gap candidates to the edge-case manifest.
 *
 * Reads runs/coverage-gap/candidates.json, appends 10 entries to
 * worker/test/fixtures/cv-edge-eval/manifest.json, increments seed,
 * and validates the result.
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

const MANIFEST_PATH = resolve(repoRoot, "worker/test/fixtures/cv-edge-eval/manifest.json");
const CANDIDATES_PATH = resolve(repoRoot, "runs/coverage-gap/candidates.json");

async function main() {
  // 1. Read candidates
  let candidates: any;
  try {
    const content = await readFile(CANDIDATES_PATH, "utf8");
    candidates = JSON.parse(content);
  } catch {
    console.error(`Candidates file not found at ${CANDIDATES_PATH}. Re-run coverage-gap.ts first.`);
    process.exit(1);
  }

  const candidateEntries = candidates.selections.map(
    (s: any) => ({
      imagePath: s.imagePath,
      groundTruthMl: s.groundTruthMl,
      reason: s.reason,
      source: s.source,
      fillBucket: s.fillBucket,
      stratum: s.stratum,
      imageId: s.imageId,
    })
  );

  console.log(`Loaded ${candidateEntries.length} candidate entries`);

  // 2. Read existing manifest
  let manifest: any;
  try {
    const content = await readFile(MANIFEST_PATH, "utf8");
    manifest = JSON.parse(content);
  } catch (err) {
    console.error(`Failed to read manifest at ${MANIFEST_PATH}:`, (err as Error).message);
    process.exit(1);
  }

  const existingCount = manifest.fixtures.length;
  console.log(`Existing manifest: ${existingCount} fixtures`);

  // 3. Check for duplicate imagePaths
  const existingPaths = new Set(manifest.fixtures.map((f: any) => f.imagePath));
  const duplicates = candidateEntries.filter((c: any) => existingPaths.has(c.imagePath));
  if (duplicates.length > 0) {
    console.error(`Error: ${duplicates.length} candidate entries have imagePaths already in manifest:`);
    for (const d of duplicates) {
      console.error(`  ${d.imagePath}`);
    }
    process.exit(1);
  }

  // 4. Make imageIds unique
  const existingIds = new Set(manifest.fixtures.map((f: any) => f.imageId));
  const dedupedEntries = candidateEntries.map((entry: any, idx: number) => {
    if (existingIds.has(entry.imageId)) {
      // Append counter suffix to avoid collision within the 10 new entries too
      const suffix = idx + 1;
      return { ...entry, imageId: `${entry.imageId}_${suffix}` };
    }
    existingIds.add(entry.imageId);
    return entry;
  });

  // 5. Append to fixtures array
  manifest.fixtures.push(...dedupedEntries);

  // 6. Increment seed
  manifest.seed = Date.now();

  // 7. Write back
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");

  // 8. Verify
  const finalCount = manifest.fixtures.length;
  console.log(`Updated manifest: ${finalCount} fixtures`);
  console.log(`New seed: ${manifest.seed}`);

  // Verify all entries have required fields
  const allValid = manifest.fixtures.every(
    (f: any) =>
      typeof f.groundTruthMl === "number" &&
      typeof f.imagePath === "string" &&
      typeof f.imageId === "string" &&
      typeof f.reason === "string" &&
      typeof f.source === "string" &&
      typeof f.fillBucket === "string" &&
      typeof f.stratum === "string"
  );
  console.log(`All entries valid: ${allValid}`);

  if (!allValid) {
    console.error("Validation failed: some entries missing required fields.");
    process.exit(1);
  }

  // Verify unique imagePaths
  const allPaths = new Set(manifest.fixtures.map((f: any) => f.imagePath));
  console.log(`Unique imagePaths: ${allPaths.size} of ${finalCount}`);

  if (allPaths.size !== finalCount) {
    // Find duplicates
    const seen = new Map<string, number>();
    for (const f of manifest.fixtures) {
      seen.set(f.imagePath, (seen.get(f.imagePath) ?? 0) + 1);
    }
    for (const [path, count] of seen) {
      if (count > 1) console.error(`  DUPLICATE: ${path} (${count}x)`);
    }
    process.exit(1);
  }

  console.log("✅ Manifest updated successfully.");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
