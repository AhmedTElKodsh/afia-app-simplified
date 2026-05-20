# Afia Technical Reference

## Purpose

This file consolidates the former comprehensive documentation, CV pipeline notes, ONNX decision gate, model-training notes, guardrail verification, and engineering setup notes into the spec tree. It is a reference for engineers who need to operate or extend the current Afia Stage 1 codebase.

## Current Truth

The active workflow is API-first product validation:

1. Product QR or barcode opens the Cloudflare scan page with bottle identity.
2. Stage 1 analyzes only 1.5L.
3. Camera capture uses front-side guidance, a functional outline, quality checks, stable-lock auto-capture, and manual fallback.
4. API analysis uses Gemini key rotation and Grok fallback.
5. Supabase persistence stores images, analysis rows, corrections, manual uploads, quality tags, and review metadata.
6. Results use the actual captured image, a fixed detected red line, remaining/consumed ml text, 55ml correction slider, and quarter-cup counter.
7. CV/ONNX/local paths remain diagnostics or future-model work until gates pass.

## Stack

| Layer | Choice |
| --- | --- |
| Runtime | Node.js 18+ |
| Package manager | pnpm workspace |
| Language | TypeScript |
| API server | Hono on Cloudflare Workers |
| Frontend | React, Vite, Tailwind CSS |
| Validation | Zod |
| Persistence | Supabase PostgreSQL and Storage |
| LLM providers | Gemini primary, Grok fallback |
| Computer vision diagnostics | OpenCV.js |
| Local model spike | ONNX Runtime Web |
| Test framework | Vitest and Testing Library |
| Deployment | Wrangler |

## Package Map

- Root workspace: orchestration scripts and workspace metadata.
- Worker package: Hono app, API routes, LLM clients, prompt loading, Supabase storage, eval tooling, CV diagnostics, and ONNX diagnostics.
- Web package: SPA routes, camera capture, mock QR, result review, admin review, i18n, and theme controls.
- Shared package: bottle constants, product link helpers, schemas, and shared result types.

## Worker Routes

| Route | Purpose | Current Stage Meaning |
| --- | --- | --- |
| `GET /api/health` | Worker liveness | Required for live smoke. |
| `POST /api/analyze` | API-first bottle analysis | Primary Stage 1 analysis route. |
| `GET /api/admin/analyses` | Admin review list | Must fail closed without admin token. |
| `PATCH /api/admin/analyses/:id` | Admin correction | Required for review/correction proof. |
| `POST /api/admin/upload` | Manual training upload | Dataset loop input. |
| `POST /api/cv-analyze` | CV diagnostics | Local diagnostic route only unless explicitly enabled later. |
| `POST /api/onnx-probe` | ONNX diagnostics | Local diagnostic route only unless explicitly enabled later. |

## Analysis Flow

The primary analysis flow receives product size and image data, validates the request, loads the current prompt bundle, calls Gemini through the configured key pool, optionally calls Grok on provider failure or low confidence, validates the structured result, writes the image and row to Supabase, and returns analysis data plus an analysis id to the web app.

The response contract should keep:

- Remaining ml.
- Consumed ml.
- Red-line Y ratio.
- Confidence.
- Provider.
- Model and prompt metadata.
- Warning and fallback metadata.
- Analysis id when persistence succeeds.

## Supabase Contract

Supabase is required for Stage 1 dataset readiness. Records should preserve:

- Image URL or storage key.
- Product size.
- Original API estimate.
- User correction.
- Admin correction.
- Manual ground truth.
- Final accepted label.
- Label source.
- Quality flags.
- Provider/fallback provenance.
- Review status.
- Admin notes.

If a result cannot be persisted, it can be useful to the current user, but it must not be counted as dataset-ready.

## Capture Quality

The capture path should reject or flag:

- Very low-resolution frames.
- Very dark frames.
- Overexposed frames.
- Very blurry or visually flat frames.
- Wrong-side, partial-bottle, glare, unsupported product, and poor-framing cases when detected by API, CV diagnostics, user correction, or admin review.

Quality tags decide whether a record becomes a trusted training label, a review candidate, or a diagnostic-only sample.

## CV And ONNX Status

The CV pipeline includes validation, preprocessing, contour/meniscus detection, confidence scoring, geometry handling, template matching, diagnostics, and typed errors. It is useful for evaluation, quality tags, and future model work.

The ONNX feasibility spike showed that tiny constant, identity, and regression models can load in local tests with acceptable binary and latency margins. The memory/RSS evidence is not enough to treat ONNX as production-safe on Workers without deployment proof. Current planning therefore uses ONNX as a future local-model candidate, not the Stage 1 primary path.

The Stage 1.5 verdict remains NO-GO on accuracy. Local model promotion requires a trusted dataset, runtime-compatible model package, browser/mobile performance evidence, and repeated 55ml accuracy sign-off.

## Evaluation And Guardrails

Useful gates:

```powershell
pnpm.cmd test
pnpm.cmd --filter @afia/shared test
pnpm.cmd --filter web test
pnpm.cmd --filter worker test
pnpm.cmd --filter web build
pnpm.cmd --filter worker build
pnpm.cmd --filter worker eval:dev-quick
pnpm.cmd --filter worker eval:cv
pnpm.cmd --filter worker gate:rss
pnpm.cmd --filter worker signoff:stage15
```

Gemini-backed evals are rate-limit sensitive. Keep the configured inter-call delay for API-backed evaluation and prefer fixtures/mocks for broad regression checks.

Guardrail verification should prove that a broken pipeline fails loudly. A run that returns all misses within the 55ml gate is useful evidence that evals can detect catastrophic regressions.

## Deployment Notes

Use explicit Windows-safe commands:

```powershell
pnpm.cmd --filter web build
pnpm.cmd --filter worker build
npm.cmd exec --yes --package wrangler@latest -- wrangler deploy --config worker\wrangler.jsonc
```

Do not print secrets in prompts, logs, summaries, or docs. Confirm the intended Cloudflare Worker and Supabase project before rotating or uploading secrets.

## Engineering Harness

The earlier Symphony notes are retained as guidance, not runtime architecture. Agent orchestration can help standardize tasks and review prompts, but it must stay outside the deployed Worker and web app. Runtime changes still need normal test/build gates, and camera/result/admin changes need real browser or phone evidence.

## Repository Cleanup Policy

The source tree should keep code, tests, specs, small committed assets, and reproducible configuration. Large local datasets, generated outputs, old planning trees, agent scratch state, logs, and dependency folders should stay ignored or out of the committed project. Planning and durable project reference content now belongs under `.kiro/specs`.
