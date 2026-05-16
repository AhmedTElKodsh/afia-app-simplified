# S09: Confidence Calibration — Context

**Gathered:** 2026-05-13
**Status:** Ready for planning
**Closes:** Confidence tautology (Winston), mock regression no signal (all), no per-stratum metrics (Amelia, Murat)

## Problem
Every successful contour detection scores ≥0.7 because edgeClarity (min 0.06) + meniscusBounds (0.2) + contourCount (0.1) + bottleRegion (0.1) = minimum 0.46. With typical edgeStrength (300+) the score hits 0.8+. So regression and LLM tiers NEVER fire — dead code.

## Expected Outcome
Confidence scoring that actually correlates with measurement accuracy. Tiers that discriminate. Per-stratum eval so we know where the pipeline works vs fails.

## Key Files
- worker/src/cv/confidence.ts
- worker/src/cv/config.ts
- worker/src/eval/cv-eval.ts
- worker/src/eval/build-edge-eval.ts (already done)
