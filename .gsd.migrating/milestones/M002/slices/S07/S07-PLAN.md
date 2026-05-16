# S07: Heuristic Improvements (Phase 2-03)

**Goal:** Improve heuristic scoring to reduce confusion.
**Demo:** Heuristic accuracy improved by +2.5pp (CLAHE 3.0).

## Must-Haves

- Complete the planned slice outcomes.

## Verification

- Run the task and slice verification checks for this slice.

## Tasks

- [x] **T01: Pre-processing Tuning (CLAHE 3.0)** `est:2h`
  Tune CLAHE and Gaussian parameters for better meniscus visibility.
  - Files: `worker/src/cv/preprocess.ts`
  - Verify: pnpm eval:cv

- [x] **T02: Fusion Evaluation & Pivot Decision** `est:1h`
  Evaluate multi-contour fusion and decide on pivot.
  - Files: `worker/src/cv/contour.ts`
  - Verify: Reverted fusion due to confusion increase.

## Files Likely Touched

- worker/src/cv/preprocess.ts
- worker/src/cv/contour.ts
