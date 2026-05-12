# Afia Oil Level Scanner - Stage 1 Stripped Plan

## Summary

Stage 1 is an eval-only Gemini API capability spike. It is not a deployed product slice.

The core question is:

> Can Gemini estimate remaining oil ml from real Afia 1.5L bottle images accurately enough to justify productizing the QR, camera, result, and admin workflow?

Stage 1 should prove or disprove the model-risk assumption before the project invests in browser UX, persistence, admin review, fallback providers, or local model work.

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
- Worker surface remains minimal with `/api/health` only.
- Web app remains placeholder-level and should not be treated as Stage 1 product scope.
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

The following are valuable, but they are not Stage 1 core. They should not be implemented as part of the stripped Stage 1 plan:

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

Add the smallest browser workflow around the proven model: QR landing, camera capture, manual capture button, static 1.5L outline guidance, `POST /api/analyze`, and a result page with the detected red line.

### Stage 3: Persistence and Admin Review

Add Supabase storage/database, Admin review queue, manual corrections, manual image upload, and dataset-building workflows for later model training.

### Stage 4: Reliability and Fallbacks

Add Gemini multi-key rotation, Grok fallback, retry policy, quota handling, monitoring, and deployment hardening after product usage justifies operational complexity.

### Stage 5: Local Model

Use the collected and corrected image dataset to train or refine a lightweight local model. The local model becomes the primary browser path only after it reaches acceptable accuracy, with LLM APIs kept as fallback.

## Implementation Notes

- Do not modify runtime APIs, schemas, or config for this documentation-only step.
- Keep existing `requirements.md`, `design.md`, and `tasks.md` unchanged for comparison until the team decides whether to rewrite the full Kiro spec set.
- Treat this document as the source of truth for stripped Stage 1 scope.
