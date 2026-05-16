---
id: M001
title: Stage 1 Remediation & Accuracy Boost
status: complete
completed_at: 2026-05-16
---

# M001: Stage 1 Remediation & Accuracy Boost - Final Summary

## Narrative
This milestone addressed critical measurement accuracy issues discovered in early evals. We established a probe baseline (S01), tested few-shot expansion (S02), and ultimately pivoted to a 'Golden Set' + visual reasoning strategy (S04). While the initial model-only experiments (S02/S04) failed to meet the ACCR-02 accuracy target through prompt engineering alone, the milestone succeeded in building the diagnostic harness and establishing the need for an ONNX-based heuristic pipeline (Phase 2).

## Key Deliverables
- **Probe Eval Harness**: Reliable baseline and v2/v3 evaluation pipeline.
- **Explicit Calibration Set**: Unified `manifest.json` ensuring eval and production use identical few-shot anchors.
- **Prompt Standard**: Unified JSON-only contract with `visualReasoning` for consistent cross-provider behavior.
- **SDK Safety**: Hardened Gemini caller with typed config and removed unsafe casts.

## Review Findings & Fixes
- **Divergence Fixed**: Production `/api/analyze` now shares the versioned prompt/few-shot path with eval.
- **Contract Aligned**: Contradictory "reasoning before JSON" vs "JSON only" instructions were merged into a single structured contract.
- **Golden Set Explicit**: Moved from implicit directory conventions to an explicit manifest.
- **Build Hardened**: Fixed OpenCV type errors in `contour.ts` that were blocking verification.

## Conclusion
Model-only prompt tuning reached a saturation point (MAE ~400ml). The milestone is closed as the foundation for the Phase 2/3 ONNX integration.
