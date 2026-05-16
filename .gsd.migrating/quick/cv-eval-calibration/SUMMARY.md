---
id: cv-eval-calibration
status: complete
completed_at: 2026-05-13
duration: ~45min
key_files:
  - worker/test/fixtures/cv-eval/manifest.json (198-image stratified manifest)
  - runs/cv-eval-200/cv-eval-*.json (eval results)
  - runs/cv-eval-200/analysis.md (findings)
verification_result: gaps_found
---

# Quick Task: CV Eval Set & Confidence Calibration

## What Happened

Built 198-image stratified eval manifest (29 fill levels, weighted toward nonlinear shoulder/base regions). Ran CV pipeline against all 198 images. Results:

- **CV exact accuracy (±55ml): 2.0%** (vs Gemini 0%)
- **Contour found: 33%** — major bottleneck
- **High-confidence accuracy: 6.1%** — confidence is too optimistic

## Key Findings

1. "Largest contour = bottle body" assumption fails on 67% of images. Background/label/lights create larger contours.
2. All detected contours score "high" confidence (≥0.7) — threshold has no discriminative power.
3. Predictions are noisy even when contour is found (errors 24-1339ml).

## Changes Made

- Created `worker/test/fixtures/cv-eval/manifest.json` (198 images, 29 levels)
- Created `runs/cv-eval-200/` with results and analysis
- Installed `sharp` for cross-platform image decoding (replaces browser-only ImageData API)

## Recommendations

1. Fix contour detection (aspect ratio + position + width heuristics instead of "largest contour")
2. Train real regression model (mock model has no refinement signal)
3. Pre-process images with contrast enhancement for low-contrast frames
4. Re-evaluate confidence thresholds after contour fix
