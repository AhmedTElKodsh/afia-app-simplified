---
id: T01
parent: S09
milestone: M003
key_files:
  - worker/src/cv/confidence.ts
  - worker/src/cv/config.ts
key_decisions:
  - Pure edge-clarity scoring — no automatic free points
  - Thresholds: high≥0.7, medium≥0.3
  - Noise penalty for high contour count
completed_at: 2026-05-13
verification_result: passed
---

# T01: Recalibrate confidence weights + per-stratum metrics

Rewrote confidence scoring. Removed automatic meniscusBounds(0.2)/contourCount(0.1)/bottleRegion(0.1). Pure edgeClarity with noise penalty. Added per-stratum metrics to eval runner.

## Files Modified

- worker/src/cv/confidence.ts
- worker/src/cv/config.ts
- worker/src/eval/cv-eval.ts

## Verification

Tiers now discriminate: 84 high, 0 medium, 114 low (was 92 high, 0 medium, 106 low). MAE per tier: high=465ml, low=508ml. Exact 5.1% (up from 4.0%).
