# S10: Contour Detection Improvement

**Goal:** Improve detection rate from 46% via adaptive fallback when Canny yields 0 contours.
**Demo:** Edge-case eval shows improved detection rate.

## Tasks

- [ ] **T01: Adaptive threshold fallback** `est:0.5h`
  When Canny yields 0 contours, retry with ADAPTIVE_THRESH_GAUSSIAN_C on a cropped region of interest (center 60% of frame). Apply morphological close to connect edge fragments.
  - Files: `worker/src/cv/contour.ts`
  - Verify: Some previously-failed images now produce contours.

- [ ] **T02: Run edge-case eval** `est:0.5h`
  Run `pnpm eval:cv` against edge-case manifest. Compare detection rate vs baseline (40%).
  - Files: `runs/edge-eval-*.json`
  - Verify: Detection rate improves on edge cases.

- [ ] **T03: Run full eval** `est:2h`
  Run against 198-image main manifest to verify no regression from the fallback addition.
  - Files: `runs/full-eval-*.json`
  - Verify: Main eval accuracy does not regress from 4.0-4.5% baseline.
