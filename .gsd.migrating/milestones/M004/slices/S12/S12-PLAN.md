# S12: CV Unit Tests

**Goal:** Add unit tests for confidence.ts, contour.ts, and geometry.ts.
**Closes:** 3 partial gaps (indirect testing) + 1 missing gap (no confidence unit tests).

## Tasks

- [ ] **T01: geometry.ts unit test** `est:15m`
  Test `calibrateFillRatio` clamping: input 0→0, input 1→1, input -0.5→0, input 1.5→1, input 0.5→0.5. Test `getBottleGeometry` for supported/unsupported sizes.
  - File: `worker/test/cv-geometry.test.ts`
  - Verify: All 6 cases pass.

- [ ] **T02: confidence.ts unit test** `est:30m`
  Test `scoreConfidence`: not-found returns 0/low. Edge strength range maps to [0,1]. Noise penalty reduces score. Extreme ratio penalty fires at <0.05/>0.95. Tier boundaries at 0.3 and 0.7.
  - File: `worker/test/cv-confidence.test.ts`
  - Verify: 8+ test cases covering score range, penalties, tier boundaries.

- [ ] **T03: contour.ts unit test** `est:30m`
  Test `detectMeniscus` with mock preprocessed image. Verify Canny threshold application, heuristic scoring rejects noise contours, mid-bottle edge preference beats extreme edges.
  - File: `worker/test/cv-contour.test.ts`
  - Verify: Returns correct ContourResult shape. Heuristic rejects tiny/off-center contours.
