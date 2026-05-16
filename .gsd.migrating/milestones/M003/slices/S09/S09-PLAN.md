# S09: ONNX Regression Model Integration

**Goal:** Integrate ONNX regression model into CV pipeline for confidence calibration and signal fusion.
**Demo:** Regression model loaded and bench-tested in CV pipeline.

## Must-Haves

- Complete the planned slice outcomes.

## Verification

- Run the task and slice verification checks for this slice.

## Tasks

- [x] **T01: Integrate ONNX Regression Model into CV Pipeline** `est:1h`
  Modify worker/src/cv/confidence.ts to include the regression model as a confidence signal. Integrate it into worker/src/cv/pipeline.ts to load and run the model during analysis. Ensure the model is loaded once and reused.
  - Files: `worker/src/cv/confidence.ts`, `worker/src/cv/pipeline.ts`, `worker/src/onnx/loader.ts`
  - Verify: npm test -- --grep "onnx model integration"

- [x] **T02: Enhance CV Eval with Stratum Metrics and ONNX Tracking** `est:45m`
  Update worker/src/eval/cv-eval.ts to include per-stratum metrics and MAE per confidence tier. Add logic to track ONNX model performance specifically. Ensure the eval report includes a breakdown of accuracy by fill bucket (stratum) as defined in the context.
  - Files: `worker/src/eval/cv-eval.ts`
  - Verify: tsx worker/src/eval/cv-eval.ts --dry-run

- [ ] **T03: Benchmark CV Pipeline with ONNX Signal** `est:30m`
  Run the full 200-image eval suite using the updated cv-eval.ts. Capture results and verify that the confidence tiers now show meaningful discrimination (e.g. higher error in lower confidence tiers). Analyze the stratum-level metrics to identify specific fill ranges where the model or heuristic performs poorly.
  - Files: `runs/cv-eval-200/cv-eval-results.json`
  - Verify: test -f runs/cv-eval-200/cv-eval-results.json

## Files Likely Touched

- worker/src/cv/confidence.ts
- worker/src/cv/pipeline.ts
- worker/src/onnx/loader.ts
- worker/src/eval/cv-eval.ts
- runs/cv-eval-200/cv-eval-results.json
