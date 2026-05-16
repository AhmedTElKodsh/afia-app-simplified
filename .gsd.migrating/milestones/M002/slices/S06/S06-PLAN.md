# S06: ONNX Feasibility Spike (Phase 2-02)

**Goal:** Prove ONNX feasibility on Cloudflare Workers.
**Demo:** ONNX benchmark report with 'proceed' verdict.

## Must-Haves

- Complete the planned slice outcomes.

## Verification

- Run the task and slice verification checks for this slice.

## Tasks

- [x] **T01: ONNX Benchmarking Infrastructure** `est:2h`
  Implement ONNX loader and benchmark runner. Generate test models.
  - Files: `worker/src/onnx/loader.ts`, `worker/src/onnx/benchmark.ts`, `worker/src/onnx/models/*.onnx`
  - Verify: pnpm --filter worker test -- onnx

- [x] **T02: ONNX Threshold Evaluation** `est:30m`
  Evaluate benchmark results against D-18 thresholds.
  - Files: `runs/onnx-benchmark/final-verdict.json`
  - Verify: cat runs/onnx-benchmark/final-verdict.json

## Files Likely Touched

- worker/src/onnx/loader.ts
- worker/src/onnx/benchmark.ts
- worker/src/onnx/models/*.onnx
- runs/onnx-benchmark/final-verdict.json
