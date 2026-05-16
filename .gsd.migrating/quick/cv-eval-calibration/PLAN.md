# Quick Task: CV Eval Set & Confidence Calibration

**Goal:** Build 200-image stratified eval set, run CV pipeline, calibrate confidence thresholds.
**Date:** 2026-05-13
**Slug:** cv-eval-calibration

## Tasks

- [ ] **T01: Build 200-image stratified manifest** `est:15m`
  Sample 200 images from oil-bottle-frames stratified by fill level. Ensure coverage across all 29 levels with emphasis on the nonlinear measurement regions (shoulder at 15%, base at 85%).
  - Files: `worker/test/fixtures/cv-eval/manifest.json`
  - Verify: 200 entries, all fill levels represented.

- [ ] **T02: Run CV eval** `est:30m`
  Run `pnpm eval:cv` against the 200-image manifest. Capture per-image results: ground truth, CV estimate, error, confidence score.
  - Files: `runs/cv-eval-200/*.jsonl`
  - Verify: Results file with 200 records.

- [ ] **T03: Analyze results & calibrate thresholds** `est:30m`
  Compute MAE per confidence tier. Find optimal confidence thresholds that minimize MAE while maximizing high-confidence predictions. Update `config.ts` with calibrated thresholds.
  - Files: `runs/cv-eval-200/analysis.md`, `worker/src/cv/config.ts`
  - Verify: Thresholds updated in config.ts, analysis report written.
