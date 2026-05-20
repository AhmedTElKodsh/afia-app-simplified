# Afia Oil Level Scanner - Stage 1 Stripped Plan

> Historical note, 2026-05-19: this document is preserved as the original eval-only stripped plan. It is no longer the active implementation source of truth when it conflicts with the live repo or `.kiro/specs/afia-roadmap/stage-1-api-only.md`. The implemented project now includes QR/product identity, camera capture, `/api/analyze`, result UI, Supabase persistence targets, and admin review surfaces. Use `.kiro/specs/afia-remaining-milestones/remaining-milestones-plan.md` for current continuation planning.

## Summary

This file documents the older eval-only Stage 1 decision point. It is retained for project history, but the active Stage 1 plan has moved beyond this stripped scope.

The core question is:

> Can Gemini estimate remaining oil ml from real Afia 1.5L bottle images accurately enough to justify productizing the QR, camera, result, and admin workflow?

The current planning set still preserves this model-risk lesson, but it now requires the deployed QR, camera, result, Supabase, and admin-review workflow to be proven before dataset or local-model milestones advance.

## Current Achieved State

The current repo already matches the stripped Stage 1 direction more closely than the larger product spec:

- Single Gemini key/model config through `GEMINI_API_KEY` and `MODEL_ID`.
- Gemini-only image analysis path with temperature `0` and structured JSON output.
- Versioned prompt assets under `worker/src/prompt/v1`.
- Strict response parsing for `remainingMl`, `consumedMl`, `redLineYRatio`, and `confidence`.
- Ground-truth comparator using ml error thresholds.
- Dev and holdout fixture manifests for repeatable evaluation.
- Eval runner that writes JSONL run records.
- Signoff gate for aggregate accuracy, per-stratum accuracy, byte-stability, and reviewer decision.
- At the time of this stripped plan, the Worker surface remained minimal with `/api/health` only.
- At the time of this stripped plan, the web app remained placeholder-level. The current Stage 1 product scope is now defined in `requirements.md`, `design.md`, `tasks.md`, and the roadmap docs.
- Test suite has been verified with `pnpm.cmd test` passing worker and web tests.

## Stage 1 Core Deliverables

Stage 1 is complete only when the project can run a repeatable evaluation and make a clear proceed, retry, or stop decision.

Required deliverables:

- Curated labeled fixture set for real Afia 1.5L bottle images.
- Gemini-only inference against fixture images.
- Stable prompt and few-shot assets that are versioned and hashable.
- Strict JSON output validation.
- Comparison of predicted remaining ml against ground truth.
- Metrics for absolute error, exact bucket pass, close bucket pass, aggregate accuracy, and per-stratum accuracy.
- Repeatable dev and holdout eval commands.
- Signoff gate with explicit pass/fail thresholds.
- Notes documenting observed failure modes and whether the model is good enough to move to productization.

## Stage 1 Acceptance Criteria

The Stage 1 eval passes only if all of the following are true:

- The eval runner processes the committed holdout manifest without manual intervention.
- Every model response is parsed or recorded as a parse failure in JSONL output.
- The latest holdout run reports aggregate exact-bucket accuracy at or above the agreed threshold.
- Every tested stratum meets the minimum per-stratum accuracy threshold.
- Repeated holdout runs meet the byte-stability threshold defined by the signoff gate.
- A reviewer records a yes/no signoff in the signoff log.
- The final Stage 1 outcome is documented as one of:
  - Proceed to Stage 2.
  - Retry prompt/data iteration on the dev set.
  - Stop or redesign the approach because Gemini is not accurate enough.

## Explicitly Deferred From Stage 1

The following were explicitly deferred from the original stripped plan. They are no longer all deferred from the active Stage 1 planning set:

- QR code scan flow.
- Camera capture UI.
- Static or functional bottle outline overlay.
- Cloudflare deployment and public web link.
- `POST /api/analyze` product API.
- Supabase database or image storage.
- Admin dashboard, review queue, correction UI, or manual upload.
- Grok fallback.
- Multi-key Gemini rotation.
- Provider abstraction, quota handling, retries, or production monitoring.
- Result page with red line overlay.
- Oil slider and cup counter UI.
- Browser E2E tests for scan/capture/result/admin flows.
- 2.5L bottle analysis.
- Local on-device model inference or training pipeline.

## Progression Roadmap

### Stage 1: Eval-Only Gemini Spike

Prove model viability using real 1.5L images, fixture manifests, strict parsing, ml comparison, JSONL run records, and signoff gates.

### Stage 2: Minimal Product Shell

The active plan has already absorbed this product shell into Stage 1. Current planning requires QR/mock QR landing, 1.5L/2.5L product identity, camera capture, functional 1.5L outline guidance with stable-lock auto-capture and manual fallback, basic quality checks, `POST /api/analyze`, and a result page with the actual captured image and fixed detected red line.

### Stage 3: Persistence and Admin Review

The active Stage 1.5/M006 plan now requires Supabase storage/database, admin review queue, user corrections, admin corrections, manual image upload, and dataset-building workflows before local-model work advances.

### Stage 4: Reliability and Fallbacks

The active Stage 1 API path now includes Gemini multi-key rotation, bounded retry, low-confidence fallback handling, Grok fallback, sanitized diagnostics, and live Cloudflare/Supabase proof gates.

### Stage 5: Local Model

Use the collected and corrected image dataset to train or refine a lightweight local model. The local model becomes the primary browser path only after dataset quality, runtime compatibility, and 55ml accuracy gates pass, with Gemini/Grok APIs kept as fallback.

## Implementation Notes

- Do not modify runtime APIs, schemas, or config for this documentation-only step.
- Treat this document as historical context only. Use `requirements.md`, `design.md`, `tasks.md`, `.kiro/specs/afia-roadmap/stage-1-api-only.md`, and `.kiro/specs/afia-remaining-milestones/remaining-milestones-plan.md` as the active workflow-planning surfaces.
