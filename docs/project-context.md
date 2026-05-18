# Afia Project Context

## Product

Afia Oil Level Scanner Stage 1 validates whether a consumer can scan a product-specific QR link, capture a usable front-side photo of a 1.5L Afia oil bottle, receive an API-only LLM oil-level estimate, inspect/correct the result, and feed accepted/corrected records into a future training dataset.

Stage 1 is intentionally API-only. Local model inference, local model training, and local-only user paths are out of scope until a correction dataset and field-quality evidence justify Stage 2.

## Current Stage 1 Roadmap

- Stage 1.0: Gemini eval-only capability spike with versioned prompts, fixture manifests, JSONL eval runner, and 55ml accuracy tracking.
- Stage 1.1: QR/product identity shell for 1.5L and unsupported 2.5L routing.
- Stage 1.2: Camera capture with environment camera, manual capture, smaller upright 1.5L outline, and downward phone-angle instruction.
- Stage 1.3: `POST /api/analyze` using Gemini multi-key rotation with Grok fallback and stable result contract.
- Stage 1.4: Result UI with captured image, red-line overlay, left vertical slider, and quarter-cup counter.
- Stage 1.5: Supabase storage/database plus admin correction and manual upload loop.
- Stage 1.6: Field pilot with quality tags, accuracy report, and proceed/iterate/redesign decision.

## Architecture

- Monorepo using pnpm workspaces.
- `worker/`: Cloudflare Worker API and static asset serving.
- `web/`: React + Vite SPA.
- `packages/shared/`: shared TypeScript constants, product link helpers, and result schemas.
- Persistence target: Supabase PostgreSQL plus Storage.
- LLM target: Gemini first, with multiple API keys, retry, and Grok fallback.

## Core Contracts

The scan result contract must preserve:

- remaining ml
- consumed ml
- red-line Y ratio
- confidence
- warnings
- provider
- raw model metadata
- prompt/model version logging

The primary evaluation unit is 55ml, equal to a quarter cup. Consumer correction and admin review should stay aligned to that unit system unless the spec changes deliberately.

## Product Boundaries

- Only 1.5L analysis is supported in Stage 1.
- 2.5L may be routed and messaged, but serious 2.5L analysis is out of scope.
- Manual capture is required first; auto-capture is not a Stage 1 requirement.
- Supabase persistence and admin correction are core Stage 1 outcomes, not optional polish.
- Every useful accepted/corrected image should become clean training data for Stage 2.

## Party Mode Guidance

Use party mode when a decision needs multiple lenses before implementation, especially:

- scope disputes between API-only validation and future local-model ambitions
- Stage 1 acceptance gate readiness
- capture UX changes that could affect image quality
- LLM provider/fallback or parsing contract changes
- Supabase/admin dataset schema decisions
- field pilot design and quality tags
- implementation sequencing across Worker, Web, Shared, and Admin surfaces

Recommended panels:

- Product scope: John, Sally, Mary, Murat.
- Architecture/API: Winston, Amelia, Murat, Paige.
- Capture/result UX: Sally, John, Murat, Amelia.
- Dataset/admin loop: Mary, Murat, Winston, Paige.
- Delivery readiness: Amelia, Murat, Winston.

## Current Implementation Reality (2026-05-18)

BMad help review places this project in the BMad Method implementation phase with documentation/project-context maintenance as an anytime support activity. The relevant next BMad options are:

- [SS] Sprint Status (`bmad-sprint-status`) to summarize implementation risks and next story flow.
- [CK] Checkpoint (`bmad-checkpoint-preview`) before human review of this branch.
- [DP] Document Project (`bmad-document-project`) or [GPC] Generate Project Context (`bmad-generate-project-context`) when code and docs drift again.

The codebase now contains the Stage 1 consumer app skeleton, the Supabase-integrated admin review loop, and a hybrid CV/Heuristic evaluation track. Stage 1.5 validation concluded with a documented **NO-GO** on accuracy, but passing marks on runtime compatibility, diagnostics, and route integration.

### Research and Evaluation Track

- Gemini eval runner lives in `worker/src/eval/run.ts` with manifest loading, JSONL writing, response parsing, model-version tracking, and sign-off helpers.
- `eval:dev-quick` runs the 12-fixture probe manifest and was verified as a regression guardrail.
- CV evaluation artifacts are under `runs/cv-eval-200/`.
- Stage 1.5 sign-off report lives in `runs/stage15-signoff/stage15-signoff.md`, recording a **NO-GO** verdict (13.3% exact accuracy) while confirming Worker compatibility and diagnostic health.

### CV, Heuristic, and ONNX Track

- CV pipeline modules live under `worker/src/cv/` and cover validation, preprocessing, contour/meniscus detection, confidence, geometry, scoring, templates, diagnostics, and typed errors.
- Stage 1.5 improvements removed the Worker-incompatible `sharp` dependency, narrowing the CV endpoint to supported JPEG/PNG inputs.
- Phase 2 heuristic tuning improved the baseline but did not meet targets; ONNX regression remains the recommended path.
- ONNX feasibility modules live under `worker/src/onnx/`; local benchmark evidence supports proceeding.

### App and Data Loop

- Worker routes include `/api/analyze`, `/api/cv-analyze` (with app-level Hono integration), `/api/admin/*`, and `/api/onnx-probe`.
- Web routes/components cover scan landing, camera capture, result review, mock QR generation, and the admin review queue.
- Supabase integration is the active persistence path for accepted/corrected records, image storage, and admin correction workflows.
- Stage 1.5 introduced a non-interactive sign-off command (`pnpm signoff:stage15`) to automate quality gate verification.

### Documentation Maintenance Rule

When implementation changes materially, update at least:

1. `docs/project-context.md` for LLM-operational project state and BMad routing.
2. `docs/COMPREHENSIVE-DOCUMENTATION.md` for detailed architecture, scripts, directories, and runbooks.
3. `README.md` for contributor-facing quick start and current scope.

Prefer concise append-only status updates over rewriting historical docs unless the old text is actively misleading.
