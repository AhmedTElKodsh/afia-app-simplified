---
estimated_steps: 1
estimated_files: 3
skills_used: []
---

# T01: ONNX Benchmarking Infrastructure

Implement ONNX loader and benchmark runner. Generate test models.

## Inputs

- None specified.

## Expected Output

- `worker/src/onnx/loader.ts`
- `worker/src/onnx/benchmark.ts`

## Verification

pnpm --filter worker test -- onnx
