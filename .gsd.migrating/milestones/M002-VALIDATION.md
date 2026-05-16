---
phase: M002/M003 (CV Pipeline)
status: gaps_found
total_requirements: 12
covered: 4
partial: 3
missing: 5
---

# Validation Audit — CV Pipeline

## Test Infrastructure

| Framework | Files |
|-----------|-------|
| Vitest (worker/test/) | 14 test files |
| Eval runner | `worker/src/eval/cv-eval.ts` |
| Ablation test | `worker/src/eval/ablation-test.ts` |

## Requirement-to-Test Map

### CV Pipeline Base

| Req | Description | Test Coverage | Status |
|-----|-------------|---------------|--------|
| CV-01 | Contour detection identifies meniscus | `cv-eval.ts` (end-to-end, 198 images) | ✅ COVERED |
| CV-02 | Image preprocessing (lighting, CLAHE) | `cv-eval.ts` (indirect — tested via pipeline) | ⚠️ PARTIAL |
| CV-03 | Contour-to-fill-ratio calibration | `cv-eval.ts` (accuracy metrics) | ⚠️ PARTIAL |
| CV-04 | Failure detection (0 contours) | No explicit test for error paths | ❌ MISSING |

### Confidence & Gating

| Req | Description | Test Coverage | Status |
|-----|-------------|---------------|--------|
| GATE-01 | Confidence score derivation | No unit test for `confidence.ts` | ❌ MISSING |
| GATE-02 | Confidence threshold calibration | `cv-eval.ts` (per-tier metrics) | ⚠️ PARTIAL |
| GATE-03 | Gating function (high/medium/low) | No unit test for tier boundaries | ❌ MISSING |

### Integration

| Req | Description | Test Coverage | Status |
|-----|-------------|---------------|--------|
| INT-01 | Worker API integration | `cv-analyze.test.ts` (exists, untested) | ❌ MISSING |
| INT-02 | Same result contract | `cv-analyze.test.ts` (shape assertions) | ❌ MISSING |
| INT-03 | Error handling contract | No explicit error shape tests | ❌ MISSING |

### Evaluation

| Req | Description | Test Coverage | Status |
|-----|-------------|---------------|--------|
| EVA-01 | Stratified probe set | `cv-eval/manifest.json` (198 images) | ✅ COVERED |
| EVA-02 | MAE + confidence intervals | `cv-eval.ts` (Wilson CI, latency, per-tier) | ✅ COVERED |
| EVA-03 | Held-out test set | `cv-edge-eval/manifest.json` (20 images) | ✅ COVERED |

## Gap Analysis

| Count | Status | Examples |
|:-----:|--------|---------|
| 4 | ✅ COVERED | E2E eval, eval manifest, edge-case manifest, per-stratum metrics |
| 3 | ⚠️ PARTIAL | Indirect testing via pipeline, no isolated unit tests |
| 5 | ❌ MISSING | Error path tests, confidence unit tests, integration test execution |

## Recommended Test Additions

| Priority | Test | File | Effort |
|----------|------|------|--------|
| P1 | `confidence.ts` unit test — verify score range [0,1], tier boundaries at 0.3/0.7 | `worker/test/cv-confidence.test.ts` | 30m |
| P1 | `contour.ts` unit test — Canny output, heuristic scoring, Sobel meniscus | `worker/test/cv-contour.test.ts` | 30m |
| P1 | `geometry.ts` unit test — calibrateFillRatio clamping | `worker/test/cv-geometry.test.ts` | 15m |
| P2 | Error path test — validate PipelineError shape per stage | `worker/test/cv-errors.test.ts` | 15m |
| P2 | Run existing `cv-analyze.test.ts` against dev Worker | — | 30m |
