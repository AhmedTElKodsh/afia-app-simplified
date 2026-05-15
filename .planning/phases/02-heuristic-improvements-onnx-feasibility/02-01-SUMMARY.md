---
phase: 02-heuristic-improvements-onnx-feasibility
plan: 01
type: execute
subsystem: eval
tags: [edge-case-corpus, coverage-gap, farthest-point-sampling, model-versioning, opencv-js]
dependency-graph:
  requires: []
  provides: [plan-02-B-heuristic-tuning, plan-03-ONNX-integration]
  affects: [worker/test/fixtures/cv-edge-eval, worker/src/eval]
tech-stack:
  added:
    - TypeScript pure data module (model-version.ts)
    - OpenCV.js feature extraction pipeline
  patterns:
    - Pure data schema with validation function
    - tsx-runnable eval scripts with error handling
    - Farthest-point sampling for coverage-gap analysis
key-files:
  created:
    - worker/src/eval/coverage-gap.ts
    - worker/src/eval/model-version.ts
    - worker/test/model-version.test.ts
    - worker/src/eval/update-edge-manifest.ts
  modified:
    - worker/test/fixtures/cv-edge-eval/manifest.json
key-decisions:
  - "ImageIds for new entries are suffixed with counters to avoid collisions within the 10-entry set"
  - "Coverage-gap script uses polling pattern for OpenCV.js WASM init (cv.Mat not ready at import time)"
  - "ModelVersion schema is a pure data module with zero runtime dependencies"
metrics:
  duration: "~30 minutes"
  tasks: 3/3
  files_created: 4
  files_modified: 1
  evaluated: 2026-05-15
---

# Phase 2 Plan 1: Edge-Case Corpus Expansion & Model Version Tracking

**One-liner:** Expanded edge-case corpus from 20 to 30 images via farthest-point sampling on 2367-image corpus, and defined typed ModelVersion schema with ONNX hash tracking for Phase 3 integration.

## Verification Results

| Check | Result |
|-------|--------|
| `tsx src/eval/coverage-gap.ts` runs and outputs 10 candidates | ✅ Passed (2367 images scanned, 2336 candidates filtered, 10 selected) |
| Manifest has exactly 30 fixtures | ✅ Passed (20 existing + 10 new = 30, all with unique imagePaths) |
| All entries have valid groundTruthMl and imageId | ✅ Passed (all `edge-` prefixed, all numeric groundTruthMl) |
| `pnpm vitest run test/model-version.test.ts` — all tests pass | ✅ Passed (9/9 tests passed) |
| `pnpm build` passes | ✅ Passed (tsc --noEmit, no errors) |

## Tasks Executed

### Task 1: Coverage-Gap Analysis Script

**Commit:** `a48a81fc`

Created `worker/src/eval/coverage-gap.ts` — a tsx-runnable analysis script that:

- Loads the existing 20 edge-case fixtures from `worker/test/fixtures/cv-edge-eval/manifest.json`
- Scans `oil-bottle-frames/` recursively for all JPEG images (2367 total, 2336 after filtering existing fixtures and non-standard directories)
- Extracts 5 feature vectors per image using OpenCV.js:
  - **Brightness** — mean grayscale pixel value
  - **Contrast** — standard deviation of grayscale
  - **Edge density** — ratio of Canny edge pixels to total
  - **Blur** — variance of Laplacian
  - **Reflection proxy** — mid-frequency Sobel gradient energy concentration in upper third
- Applies min-max normalization across all feature vectors
- Runs greedy farthest-point sampling to select 10 candidates with maximal minimum distance to the 20 existing fixtures
- Assigns `reason: "gap_{feature}"` based on which feature dimension drove each selection
- Outputs candidate entries as JSON array to stdout and detailed feature vectors to `runs/coverage-gap/candidates.json`
- Handles missing corpus, manifest parse errors, and OpenCV.js init failures with descriptive error messages

**Notable technical detail:** `@techstark/opencv-js` provides its WASM module as a thenable that never resolves in Node.js. The script uses a polling loop (200ms intervals, 30s timeout) to wait for `cv.Mat` to become available.

### Task 2: Expanded Edge-Case Corpus

**Commit:** `76328e0a`

- Appended 10 coverage-gap candidates to `worker/test/fixtures/cv-edge-eval/manifest.json`
- New entries span diverse fill levels: empty (4), 440ml (1), 550ml (1), 1045ml (1), 1375ml (1), 1485ml (2)
- Fill buckets covered: empty-low (4), mid-low (2), high (4)
- Driving features for selection: brightness (4), blur (3), edge (2), contrast (1)
- Seed incremented from `1778767051067` to `1778858645797`
- All 30 entries validated: unique imagePaths, non-null groundTruthMl, all fields present
- Original 20 fixtures preserved unchanged

**Helper:** Created `worker/src/eval/update-edge-manifest.ts` for re-running the update step.

### Task 3: Model Version Tracking Scheme

**Commit:** `4db232d5`

Created two files:

`worker/src/eval/model-version.ts` — pure data module with:
- `EvalSummary` interface: date, testSet, exactAccuracy, closeAccuracy, mae, rmse, sampleCount
- `ModelVersion` interface: onnxHash, extractorVersion, promptHash (nullable), evalSummary
- `createModelVersion()` factory function with optional promptHash (defaults to null)
- `validateModelVersion()` function returning string[] of errors (7 validation rules)

`worker/test/model-version.test.ts` — 9 passing Vitest tests:
- Valid creation, null promptHash default
- Validation passes on valid input
- Rejects invalid onnxHash, empty extractorVersion, out-of-range accuracy, negative mae, zero sampleCount, invalid date format

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] OpenCV.js WASM initialization hangs in tsx context**
- **Found during:** Task 1 (coverage-gap script creation)
- **Issue:** `@techstark/opencv-js` exports a thenable module whose `.then()` never resolves in Node.js (tsx runner). `cv.Mat` is `undefined` at import time but becomes a function after ~5 seconds.
- **Fix:** Replaced `await cvModule` with a polling loop that checks `typeof cv.Mat === "function"` every 200ms with a 30s timeout. Matches the initialization pattern observed in existing pipeline code.
- **Files modified:** `worker/src/eval/coverage-gap.ts`
- **Commit:** a48a81fc

**2. [Rule 2 - Missing critical functionality] Unique imageIds for new manifest entries**
- **Found during:** Task 2 (manifest update)
- **Issue:** The 10 new candidate entries had duplicate `imageId` values (4x `edge-gap_brightness`, 3x `edge-gap_blur`, 2x `edge-gap_edge`). While the existing manifest already has duplicate imageIds, making them unique within the new set avoids potential confusion in eval output.
- **Fix:** `update-edge-manifest.ts` appends counter suffixes to duplicate imageIds when appending to the manifest.
- **Files modified:** `worker/test/fixtures/cv-edge-eval/manifest.json`, `worker/src/eval/update-edge-manifest.ts`
- **Commit:** 76328e0a

### Scope Boundary Observations

- **Out of scope:** The plan references an "870-image corpus" but the actual `oil-bottle-frames/` directory contains 2367 images. The script handles this correctly — more candidates means better coverage-gap selection.

## Threat Flags

None. All surfaces introduced by this plan (coverage-gap.ts file system reads, model-version.ts schema types) align with the `accept` dispositions in the threat model (T-02-01-01, T-02-01-02). No new network endpoints, auth paths, or file access patterns beyond hardcoded project-internal paths.

## Known Stubs

None. All created files are complete implementations with no placeholder/stub patterns.

## Deferred Issues

None.

## Self-Check: PASSED

- [x] `worker/src/eval/coverage-gap.ts` created (555 lines, ≥80 min_lines ✅)
- [x] `worker/test/fixtures/cv-edge-eval/manifest.json` has 30 fixtures, all with `imageId: "edge-"` ✅
- [x] `worker/src/eval/model-version.ts` created (51 lines, ≥30 min_lines ✅)
- [x] `worker/test/model-version.test.ts` created (94 lines, ≥15 min_lines ✅)
- [x] Commit a48a81fc exists ✅
- [x] Commit 76328e0a exists ✅
- [x] Commit 4db232d5 exists ✅
- [x] All `must_haves` truth conditions met ✅
