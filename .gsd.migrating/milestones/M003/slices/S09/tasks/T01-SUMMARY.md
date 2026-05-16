---
id: T01
parent: S09
milestone: M003
key_files:
  - worker/src/cv/confidence.ts
  - worker/src/cv/pipeline.ts
  - worker/test/onnx-integration.test.ts
key_decisions:
  - Integrated ONNX regression model into the CV pipeline as a confidence calibration signal.
  - Implemented lazy loading for the ONNX model to avoid overhead for unused pipelines.
  - Fused heuristic confidence score with ONNX model score using simple averaging to dampen outliers.
duration: 
verification_result: passed
completed_at: 2026-05-16T17:45:42.456Z
blocker_discovered: false
---

# T01: Integrated ONNX regression model into CV pipeline for confidence calibration and signal fusion.

**Integrated ONNX regression model into CV pipeline for confidence calibration and signal fusion.**

## What Happened

I integrated the ONNX regression model into the computer vision pipeline. 

1. **Confidence Signal Integration**: Modified `worker/src/cv/confidence.ts` to accept an optional `onnxScore`. If provided, this score is averaged with the existing heuristic confidence score to produce a 'calibrated' confidence.
2. **Pipeline Integration**: Updated `worker/src/cv/pipeline.ts` to:
   - Lazily load the ONNX regression model before the main pipeline execution begins.
   - Run inference after contour detection if the model is successfully loaded.
   - Extract features for the model (edge strength, contour count, and fill ratio).
   - Pass the model's output score to the confidence scoring stage.
3. **Observability**: Added `onnxScore` and `onnxLoadStatus` to the pipeline diagnostics and added a new pipeline stage `onnx_inference` for better visibility in logs.
4. **Verification**: Created a new test file `worker/test/onnx-integration.test.ts` with mocked ONNX runtime to verify the lazy loading logic, inference triggering, and confidence fusion. Verified that the pipeline correctly handles cases where the model fails to load or inference fails.

## Verification

Ran `npx vitest run test/onnx-integration.test.ts` in the `worker` directory. Both tests passed, confirming correct lazy loading and score integration.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd worker && npx vitest run test/onnx-integration.test.ts` | 0 | ✅ pass | 1220ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `worker/src/cv/confidence.ts`
- `worker/src/cv/pipeline.ts`
- `worker/test/onnx-integration.test.ts`
