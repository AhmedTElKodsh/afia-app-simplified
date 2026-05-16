---
id: M002
title: "Heuristic Improvements & ONNX Feasibility"
status: complete
completed_at: 2026-05-16T15:02:52.208Z
key_decisions:
  - Proceed with ONNX integration for Stage 1.5 (D001/D-23)
  - Tuned best pre-processing to CLAHE 3.0 (D-20)
  - Reverted multi-contour fusion due to confusion penalty (D-22)
key_files:
  - worker/src/onnx/loader.ts
  - worker/src/cv/preprocess.ts
  - docs/phase-02-summary.md
lessons_learned:
  - Heuristic tuning has diminishing returns (+2.5pp was hard-won).
  - RSS measurement in Node.js is not representative of Workers.
---

# M002: Heuristic Improvements & ONNX Feasibility

**Proven ONNX feasibility and established heuristic baseline; ready for Phase 3.**

## What Happened

M002 (Phase 2) successfully explored the limits of heuristic measurement and proved the technical feasibility of ONNX on Cloudflare Workers. It established the baseline and data foundation (30-image corpus) required for the subsequent regression model training.

## Success Criteria Results

- [x] Edge-case expansion: Completed (30 images)
- [x] ONNX benchmark: Passed D-18 thresholds
- [x] Heuristic improvement: Gained +2.5pp accuracy
- [x] Decision documentation: Completed

## Definition of Done Results

- [x] Proven ONNX feasibility (S06)
- [x] Measurable accuracy gain (+2.5pp, S07)
- [x] Durable documentation (S08)
- [x] Model versioning established (S05)

## Requirement Outcomes

ACCR-01 (ONNX feasible): Validated. ACCR-02 (Heuristic precision): Partially validated; pivot to regression required.

## Deviations

None.

## Follow-ups

None.
