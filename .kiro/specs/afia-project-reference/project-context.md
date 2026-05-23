# Afia Project Context

## Purpose

This file replaces the former project-context document under the old documentation folder. It gives a cold reader the current product intent, active boundaries, operating rules, and review lenses after the planning consolidation into `.kiro/specs`.

## Product

Afia Oil Level Scanner Stage 1 validates whether a consumer can scan a product-specific QR or barcode link, capture a usable front-side photo of a 1.5L Afia oil bottle, receive an API-first oil-level estimate, inspect or correct the result, and feed accepted/corrected records into a future training dataset.

Stage 1 is intentionally API-first. Local model inference, local model training, and local-only user paths remain downstream until the correction dataset, field-quality evidence, and accuracy gates justify Stage 2.

## Required Workflow

1. The user scans a product barcode or current mock QR.
2. The product identity preserves 1.5L or 2.5L size, but only 1.5L analysis is enabled now.
3. The Cloudflare scan link requests camera access on the phone.
4. The capture surface asks for the front side of the bottle.
5. A functional 1.5L outline guides distance, alignment, and downward phone angle.
6. The guide moves through red, orange, and green states, with auto-capture only after a stable green lock.
7. Manual capture remains available when auto-capture is unavailable or unreliable.
8. The app rejects or flags very low-resolution, poorly lit, overexposed, or very blurry/flat captures when frame data is available.
9. Stage 1 analysis uses Gemini first with key rotation, optional explicitly configured OpenRouter image-capable routing, and Grok fallback on provider failure or configured low-confidence paths.
10. Supabase stores captured images, analysis rows, user corrections, admin corrections, manual uploads, label-source metadata, quality tags, and review status.
11. The result screen shows the real captured image, fixed detected red line, remaining/consumed ml, a 55ml-step correction slider, and a quarter-cup counter.
12. Stage 2 can promote a browser/mobile local model only after M006 dataset readiness and M007 accuracy gates pass.

## Current Stage Map

- Stage 1.0: Gemini eval capability spike with versioned prompts, fixture manifests, JSONL eval output, and 55ml tracking.
- Stage 1.1: QR/product identity shell for 1.5L and unsupported 2.5L routing.
- Stage 1.2: Camera capture with environment camera, functional outline, quality checks, stable-lock auto-capture, and manual fallback.
- Stage 1.3: API analysis through Gemini rotation, optional OpenRouter vision routing, and Grok fallback.
- Stage 1.4: Result UI with actual image, fixed red line, correction slider, and cup counter.
- Stage 1.5: Supabase storage/database plus admin correction and manual upload loop.
- Stage 1.6: Field pilot with quality tags, accuracy report, and proceed/iterate/redesign decision.
- Stage 2: Dataset-backed local model candidate with API fallback.
- Stage 3: Local-first or local-only prelaunch once local inference earns trust.

## Architecture

- Monorepo using pnpm workspaces.
- Worker package: Cloudflare Worker API and static asset serving.
- Web package: React and Vite SPA.
- Shared package: TypeScript constants, product link helpers, and result schemas.
- Persistence target: Supabase PostgreSQL plus Storage.
- LLM target: Gemini first, with multiple API keys, optional explicitly configured OpenRouter vision routing, retry, low-confidence fallback handling, and Grok fallback.
- Local diagnostics: CV, heuristic, and ONNX experiments support future model work but are not Stage 1 production primary.

## Core Contracts

Every accepted analysis or review record should preserve:

- Product size.
- Remaining ml.
- Consumed ml.
- Red-line Y ratio.
- Confidence.
- Quality warnings.
- Provider and model metadata.
- Prompt, model, and dataset version metadata where applicable.
- Original estimate.
- User-submitted correction.
- Admin correction.
- Final accepted label.
- Label source.
- Review status.

The primary measurement unit is 55ml, equal to one quarter cup. Consumer correction, admin review, and evaluation should stay aligned to that unit unless the spec changes deliberately.

## Current Reality

Local verification has covered shared tests, web tests, Worker tests, web build, Worker build, and Stage 1.5 sign-off tooling. Stage 1.5 sign-off records a NO-GO on accuracy, so working screens are not an accuracy claim.

The live S17 proof narrowed the immediate blocker: health, prompt loading, and Gemini provider execution crossed the deployed Worker boundary, but Supabase persistence failed with an image-upload signature verification error. M005 therefore remains active until the deployed service-role configuration is corrected and a real phone-to-admin trace is proven.

## Product Boundaries

- Only 1.5L analysis is supported during Stage 1.
- 2.5L may be routed and messaged, but serious 2.5L analysis is out of scope until 1.5L is stable.
- Manual capture remains a required fallback while auto-capture thresholds are tuned.
- Supabase persistence and admin correction are Stage 1 product gates, not optional polish.
- CV/ONNX/local diagnostics must not be treated as production support until runtime, memory, parity, and accuracy gates pass.
- User corrections and admin corrections are review evidence, not automatic ground truth.

## Review Lenses

Use a product, UX, architecture, and QA roundtable when a decision affects:

- Stage boundary or acceptance gate readiness.
- Capture guidance or camera ergonomics.
- LLM provider, fallback, parsing, or persistence contracts.
- Supabase/admin dataset schema decisions.
- Field pilot design, quality tags, or dataset inclusion rules.
- Sequencing across Worker, Web, Shared, and Admin surfaces.

## Documentation Rule

The canonical planning and reference home is now `.kiro/specs`. Do not recreate separate `.planning` or `docs` trees for project strategy. When implementation changes materially, update the roadmap, active stage requirements, remaining-milestones packet, and project-reference files in the same pass.
