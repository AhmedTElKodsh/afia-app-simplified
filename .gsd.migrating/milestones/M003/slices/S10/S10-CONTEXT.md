# S10: Contour Detection Improvement — Context

**Gathered:** 2026-05-13
**Status:** Ready for planning
**Closes:** 54% miss rate (all 4 reviewers), Otsu Canny tested and regressed

## Problem
106/198 images (54%) produce zero contours. Fixed Canny(50,150) is optimal for these frames per exhaustive testing. Otsu, adaptive threshold, and adaptive CLAHE all regressed. Template matching failed completely.

## Approach
Instead of replacing Canny, add a fallback chain:
1. Canny(50,150) — primary
2. If 0 contours → adaptive threshold + morphological close on region of interest (not full image)
3. If still 0 → return CONTOUR_NOT_FOUND with diagnostics

## Edge-case baseline
Current: 0/20 exact on edge-case manifest. Target: ≥5/20 after S10.

## Key Files
- worker/src/cv/contour.ts
- worker/test/fixtures/cv-edge-eval/manifest.json
