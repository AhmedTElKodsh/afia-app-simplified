# S12: CV Unit Tests — Context

**Gathered:** 2026-05-13
**Status:** Ready for planning
**Closes:** 3 partial gaps + 1 missing gap from validation audit

## Problem
The CV pipeline has 0 unit tests. confidence.ts, contour.ts, and geometry.ts are only tested indirectly through the end-to-end eval runner. This makes it impossible to verify individual stage behavior, and regressions are only caught by full eval runs.

## Key Files Under Test
- worker/src/cv/geometry.ts — calibrateFillRatio, getBottleGeometry
- worker/src/cv/confidence.ts — scoreConfidence with extreme-ratio penalty
- worker/src/cv/contour.ts — detectMeniscus, heuristic scoring, mid-bottle edge preference
