# CV Eval Analysis — 198 Images

**Date:** 2026-05-13
**Pipeline:** OpenCV contour detection + Sobel horizontal edges + confidence gating

## Overall Results

| Metric | Value |
|--------|-------|
| Total images | 198 |
| Contour found | 66/198 (33%) |
| Contour not found | 132/198 (67%) |
| Exact (±55ml) | 4/198 (2.0%) |
| Close (±110ml) | 6/198 (3.0%) |

## Per Confidence Tier

| Tier | Images | Exact | % |
|------|--------|-------|---|
| High (≥0.7) | 66 | 4 | 6.1% |
| Low | 132 | 0 | 0.0% |

## Key Findings

1. **Contour detection fails on ~67% of images.** The bottle body is not the largest contour in most photos. The assumption "largest contour = bottle body" is incorrect for these images — background, label, and lighting artifacts create larger contours.

2. **Confidence scoring is too optimistic.** All detected contours score "high" (≥0.7) but only 6.1% are actually accurate. The edge clarity and contour count heuristics don't correlate well with measurement accuracy.

3. **When contour IS found, predictions are noisy.** Errors range from 24ml to 1339ml with no clear pattern.

## Recommendations

1. **Fix contour detection.** Instead of "largest contour = bottle body," add heuristics: aspect ratio (bottle is tall), position (centered in frame), width consistency (bottle is roughly vertical). Consider template matching or reference markers.

2. **Add regression model.** The mock model doesn't actually refine predictions. A trained regression model is essential.

3. **Lower confidence thresholds.** Since all detected contours score "high," the threshold of 0.7 has no discriminative power. Re-evaluate after contour detection improvements.

4. **Pre-filter empty/full frames.** Many "contour not found" cases are uniform-lit frames where the bottle blends into the background. Add contrast enhancement before contour detection.
