# S02: Few-Shot Expansion & Prompt Refinement

**Goal:** Improve model performance by expanding few-shot anchors and refining prompts.
**Demo:** Improved probe results with better accuracy.

## Must-Haves

- Probe set results show reduced error and fewer high-confidence misses.

## Proof Level

- This slice proves: probe set eval results

## Verification

- Detailed per-fixture analysis.

## Tasks

- [x] **T01: Analyze probe failures** `est:30m`
  Analyze the probe run records to understand why the model is failing (e.g., misidentifying the meniscus, repeating few-shots). Inspect raw outputs and images if possible.
  - Files: `runs/*.jsonl`
  - Verify: Narrative report in task summary.

- [ ] **T02: Expand few-shot anchors** `est:45m`
  Expand the few-shot anchors to include more variety in bottle appearance and oil levels. Ensure `oilSurfaceYRatio` in few-shots is accurately calculated from `remainingMl`.
  - Files: `worker/src/prompt/v1/few-shots/*.json`
  - Verify: Check new files in worker/src/prompt/v1/few-shots/.

- [ ] **T03: Refine prompts** `est:30m`
  Refine system.md and bottle-reference.md to emphasize visual feature detection (e.g., "detect the curve of the meniscus") and penalize pattern matching from few-shots.
  - Files: `worker/src/prompt/v1/system.md`, `worker/src/prompt/v1/bottle-reference.md`
  - Verify: Check file content for improved instructions.

- [ ] **T04: Run probe eval (v2)** `est:15m`
  Run the probe eval again with the improved prompts and few-shots. Expect better accuracy and less few-shot repetition.
  - Files: `runs/*.jsonl`
  - Verify: Compare accuracy metrics with S01 baseline.

## Files Likely Touched

- runs/*.jsonl
- worker/src/prompt/v1/few-shots/*.json
- worker/src/prompt/v1/system.md
- worker/src/prompt/v1/bottle-reference.md
