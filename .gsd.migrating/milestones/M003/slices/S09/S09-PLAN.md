# S09: Confidence Calibration

**Goal:** Fix confidence scoring so tiers actually discriminate. Add per-stratum eval metrics.
**Demo:** Eval output shows accuracy per fill bucket and confidence tier.

## Tasks

- [ ] **T01: Recalibrate confidence weights** `est:0.5h`
  Remove automatic "free" points. Make edgeClarity dominant. Ensure sum of weights = 1.0. Thresholds at 0.8/0.5. Add calibration validation.
  - Files: `worker/src/cv/confidence.ts`, `worker/src/cv/config.ts`
  - Verify: Some successful detections score "medium" or "low".

- [ ] **T02: Add per-stratum eval metrics** `est:0.5h`
  Modify eval runner to report accuracy by fill bucket (empty-low, mid-low, mid-high, high) and by source (real vs aug). Also report MAE per tier.
  - Files: `worker/src/eval/cv-eval.ts`
  - Verify: Eval output shows stratum breakdown.

- [ ] **T03: Run calibration eval** `est:1h`
  Run `pnpm eval:cv` against both main manifest and edge-case manifest. Verify confidence tiers discriminate. Report per-stratum numbers.
  - Files: `runs/calibration-*.json`
  - Verify: Tiers show different accuracy rates.
