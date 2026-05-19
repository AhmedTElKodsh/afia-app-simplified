---
phase: 02
name: Heuristic Improvements & ONNX Feasibility
status: context-captured
decisions:
  - "D-15: Edge-case images sourced from the existing 870-image offline corpus, not production or synthetic"
  - "D-16: ONNX spike starts with constant output model, staged to identity, then regression if budget allows"
  - "D-17: Heuristic improvements follow B→A→C order — pre-processing first, then contour param tuning, evaluate multi-contour fusion"
  - "D-18: ONNX decision gate thresholds — binary ≤15MB, inference p95 ≤500ms, peak RSS ≤80MB, cold-start ≤2,000ms"
  - "D-19: Fallback rule — any metric exceeding threshold consistently across 50+ warm-up runs triggers heuristic+LLM fallback"
---

# Phase 2: Heuristic Improvements & ONNX Feasibility

## Goal

Improve existing heuristic scoring to reduce confusion errors and prove ONNX deployment path on Workers.

## Requirements

| Req | Description | Priority |
|-----|-------------|----------|
| ACCR-05 | Edge-case image corpus (20-30 labelled images) | Feeds heuristic tuning |
| ACCR-06 | Model version tracking scheme (ONNX hash, extractor version, prompt hash, eval summary) | Needed before ONNX integration |
| ACCR-02 | Heuristic scoring: ≤1 false full/empty per 10 holdout images | Core accuracy target |
| ACCR-01 | ONNX feasibility spike — tiny model, measure memory/latency/RSS/cold-start | Proves deployment path |
| TEST-02 | ONNX model loading test in Workers runtime | Verifies runtime compatibility |

## Success Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | Heuristic confusion ≤1 false per 10 holdout | Run eval:holdout after tuning, check confusion matrix |
| 2 | Tiny ONNX deploys and runs in Worker | wrangler deploy test Worker with ONNX model, hit endpoint |
| 3 | ONNX memory/cold-start budget validated | Model size, p95 latency, peak RSS under load |
| 4 | Decision gate: if ONNX > budget → heuristic + LLM | Thresholds documented (D-18), fallback path defined |
| 5 | Edge-case corpus 20-30 images labelled | Fixtures on disk, eval:edge passes |
| 6 | Model version tracking scheme defined | Schema documented, test verifies format |
| 7 | ONNX model loading test passes in Workers runtime | Vitest test passes in CI |
| 8 | Edge-case images available BEFORE heuristic tuning | Plan ordering enforces this |

## Captured Decisions (Party Mode Roundtable)

### D-15: Edge-case Sourcing
- **Decision:** Mine additional 10 images from the existing 870-image offline corpus
- **Rationale:** Available immediately, zero latency, ground truth verifiable. Run coverage-gap analysis — vectorize by feature (brightness, contrast, edge density, blur, reflection) — select 10 most dissimilar images via farthest-point sampling
- **Fallback:** If corpus has blind spots (e.g. no occlusion/motion-blur), augment those specific gaps with targeted synthetic transforms

### D-16: ONNX Scope
- **Decision:** Staged approach — constant output first, then identity passthrough, then small regression model
- **Day 1 AM:** Constant model (~10KB) — measure load + inference
- **Day 1 PM:** Identity model — validate I/O wiring
- **Day 2-3:** Regression model — realistic perf numbers
- **Go/no-go gate after each stage**

### D-17: Heuristic Attack Vector
- **Decision:** B → A → C ordering
  1. Pre-processing (CLAHE + bilateral filter) — address root cause of varying image quality
  2. Tune contour params (area ratios, confidence threshold) — cheap optimization
  3. Evaluate multi-contour fusion if B+A insufficient
- **Constraint:** Run pre-processing on full 870-image corpus to verify no regression before touching holdout

### D-18: ONNX Decision Gate Thresholds

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| Model binary | ≤15 MB | ort-web WASM + model; above this, total pushes compile time and RSS past safe margins |
| Inference p95 | ≤500 ms | User feels it but stays competitive with LLM latency compromise |
| Peak RSS | ≤80 MB | Leaves 48 MB for runtime, KV bindings, concurrent request handling |
| Cold-start | ≤2,000 ms | Acceptable for warm-up request; can relax to 5s if unrealistic |

### D-19: Fallback Rule
- If ANY metric exceeds threshold consistently across 50+ warm-up runs → fall back to heuristic + LLM
- Fail early: if binary >15 MB, skip measuring rest
- Phase 3 scope adjustment if fallback: MAE targets revised, ~800ms LLM latency added

## Carry-over Decisions from Phase 1

- **D-07/D-08:** No --env split until Phase 5. Phase 2 deploys to afia-stage1.workers.dev
- **D-09:** Shared API keys. CI eval runs against same key pool as staging
- **D-12:** Degraded results view reserved for when Phase 2 CV pipeline returns partial results

## Plan Decomposition

Recommended split:

| Plan | Focus | Requirements | Dependencies |
|------|-------|-------------|--------------|
| A | Edge-case corpus expansion (10 images) + model version tracking scheme | ACCR-05, ACCR-06 | None (feeds B) |
| B | Heuristic scoring improvements (pre-processing → tune → fusion eval) | ACCR-02 | A (needs edge-case corpus) |
| C | ONNX feasibility spike (constant → identity → regression) | ACCR-01, TEST-02 | None (parallel to B) |
| D | Decision gate + documentation (integrate B & C findings) | Wrap-up | B, C |

Plans A, C can run in parallel. Plan B depends on A. Plan D depends on B, C.
