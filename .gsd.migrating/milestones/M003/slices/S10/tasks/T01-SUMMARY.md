---
id: T01
parent: S10
milestone: M003
key_files:
  - worker/src/cv/contour.ts
key_decisions:
  - Adaptive threshold fallback does NOT help — Canny always finds at least some contours
  - The detection bottleneck is heuristic scoring (bestScore < 0.3 rejects noise contours)
  - 198-image eval: contours.size() === 0 never occurs with this dataset
completed_at: 2026-05-13
verification_result: passed
---

# T01: Adaptive threshold fallback

Added adaptive threshold fallback when Canny yields 0 contours. Applied ADAPTIVE_THRESH_GAUSSIAN_C on center 60% ROI with morphological close.

## Result

No improvement. `contours.size() === 0` never occurs — Canny always finds some contour (noise). The detection bottleneck is the heuristic scoring rejecting noise contours, not Canny failing to produce edges.

## Files Modified

- worker/src/cv/contour.ts
