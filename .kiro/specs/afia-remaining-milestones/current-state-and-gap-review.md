# Afia Remaining Milestones - Current State And Gap Review

Updated: 2026-05-19

## Purpose

This document compares the current GSD/project state against the requested product workflow:

1. Product barcode or mock QR.
2. Cloudflare scan link.
3. Camera capture with front-side guidance, functional outline, stable-lock auto-capture, and manual fallback.
4. Basic quality detection for low resolution, poor lighting, overexposure, and blur.
5. Analysis through API models first, then a local model later with API fallback.
6. Result screen with real bottle image, red line, 55ml slider, and cup counter.

It is intentionally additive. Older plans remain useful history, but this review should be used to plan the remaining milestones.

## Source Priority

Use this source order when documents disagree:

1. Current code and tests in `web/`, `worker/`, and `packages/shared/`.
2. Consolidated milestone reviews in `.kiro/specs/afia-remaining-milestones/` and `.kiro/specs/afia-project-reference/legacy-planning-archive.md`.
3. `.kiro/specs/afia-roadmap/*`.
4. Older stripped plans and historical local snapshots.

Repository cleanup update, 2026-05-19: the former `.gsd` tree, generated sign-off folders, and older agent scratch folders were removed after their durable planning value was consolidated into `.kiro/specs`. Do not use `.gsd` or `runs/stage15-signoff/` as active sources of truth in this repo.

Review update, 2026-05-19: local verification now has two different meanings and must not be blurred. Shared tests, web tests, the full default Worker suite, web build, worker build, and `signoff:stage15` pass after reconciling direct Gemini `fetch` tests, diagnostics-only CV/ONNX route tests, fail-closed admin auth, low-confidence Grok fallback, and user correction persistence. The deployed Worker still returns `501` for `/api/cv-analyze` and `/api/onnx-probe` by design.

## Current GSD Status

| GSD milestone | Recorded outcome | Product meaning |
| --- | --- | --- |
| M001: Stage 1 Remediation & Accuracy Boost | Complete with gaps found. LLM prompt tuning failed. | Pure LLM vision was not accurate enough for oil-level regression. |
| M002: Heuristic Improvements & ONNX Feasibility | Complete. CV/ONNX infrastructure and eval path exist. | The project pivoted from prompt-only to CV/ONNX plus API support. |
| M003: ONNX Integration & Fusion | Complete, but business verdict is NO-GO. | Heuristic + ONNX + optional LLM fusion is wired, but accuracy is far below target. |
| M004: Validation & Test Coverage | Complete. Unit and integration-style tests added for CV/error surfaces. | Test coverage improved, but this does not make the model accurate. |

Former GSD requirements consolidated from `.gsd/REQUIREMENTS.md`:

| Requirement | Current status | Interpretation |
| --- | --- | --- |
| R001: Accurate oil level estimation | Active, not validated. | The current sign-off is a diagnostic failure, not product readiness. |
| R002: Admin review/correction interface | Active, not validated in GSD. | UI/API surfaces exist, but GSD still needs a dedicated validation milestone. |

Stage 1.5 sign-off result:

| Metric | Current value | Target |
| --- | ---: | ---: |
| Exact accuracy within 55ml | 13.3% | 90% |
| Close accuracy within 110ml | 16.7% | 95% |
| Mean absolute error | 676.7ml | 45-55ml planning target |
| Verdict | NO-GO | GO required before product claims |

Current test gate result:

| Gate | Result | Interpretation |
| --- | --- | --- |
| `pnpm.cmd --filter @afia/shared test` | Pass | Shared bottle/product/result contracts are locally green. |
| `pnpm.cmd --filter web test` | Pass | Consumer/admin component flows are locally green. |
| `pnpm.cmd --filter web build` | Pass | Current SPA assets build for Worker serving. |
| `pnpm.cmd --filter worker build` | Pass | Worker TypeScript compiles. |
| Focused Worker API/admin tests | Pass | `/api/analyze`, admin routes, user corrections, Supabase storage mocks, and Stage 1 flow are locally green. |
| `pnpm.cmd --filter worker test` | Pass | Default suite is now aligned with API-first deployed runtime plus local diagnostics-only CV/ONNX routes. |
| `pnpm.cmd --filter worker signoff:stage15` | Pass command, NO-GO verdict | Sign-off tooling is healthy; accuracy remains failed. |

## Workflow Comparison

| Requested workflow step | Achieved so far | Remaining gap |
| --- | --- | --- |
| 1. User scans Afia barcode or mock QR. Use separate 1.5L and 2.5L identities, focus analysis on 1.5L. | `MockQrPage`, `buildMockQrSvg`, `buildProductScanUrl`, and shared bottle constants support 1.5L and 2.5L mock QR identities. `ScanShell` preserves 2.5L identity but blocks analysis. | Real barcode/packaging QR is not integrated. 2.5L is identity-only and should remain unsupported for analysis until 1.5L succeeds. |
| 2. QR opens Cloudflare deployed link and prompts camera. | Cloudflare Worker route exists, SPA fallback exists, and previous live URL was `https://afia-stage1.savola.workers.dev`. `CaptureShell` requests environment-facing camera access. | The current dirty worktree and deployed runtime need a fresh phone smoke before claiming demo readiness. |
| 3. Camera opens on bottle front side with outline guidance and auto-capture. | `CaptureShell` has front-side copy, environment camera, manual capture fallback, transparent 1.5L outline, live silhouette alignment, closer/farther/angle guidance, red/orange/green state, and auto-capture after a stable green lock. | Need real-phone tuning against floating controls, small screens, glare, labels, and varied backgrounds before calling this production-ready. |
| 4. Basic quality detection for lighting/resolution/blur. | The user capture path rejects very low-resolution, very dark, overexposed, and very blurry/flat frames when browser canvas data is available. Shared warning taxonomy and CV diagnostics cover broader tags such as blur, glare, wrong side, partial bottle, poor framing, unsupported product, and uncertain label. | M006 still needs dataset/export rules so quality tags decide which records become training labels and which stay diagnostics only. |
| 5. API analysis first, collect images/corrections, train local lightweight model, later local primary with API fallback. | `/api/analyze` calls Gemini with key rotation, can route to configured OpenRouter image-capable models, can fall back to Grok, then persists to Supabase. `/api/cv-analyze` and ONNX/fusion diagnostics exist separately. Real and augmented image folders exist. | The primary user path is still API-first, while CV/ONNX is diagnostic and has a NO-GO accuracy verdict. A local model cannot become primary until dataset quality, retraining, and new sign-off metrics improve. |
| 6. Result shows actual scanned image with red line, remaining/consumed text, 55ml left slider, and cup counter. | `ResultShell` uses the actual camera raster image, fixed detected red line, left 55ml slider, cup counter, and explicit accept/submit correction action when an `analysisId` exists. `AdminShell` mirrors a red-line preview and supports manual corrected ml. | Admin correction exists but GSD still needs deployed/live validation before R002 is marked complete. |

## Main Gaps

### Product Demo Readiness

The browser and Worker surfaces exist, but the current end-to-end phone demo still needs a fresh proof:

- Scan 1.5L QR on a real phone.
- Open deployed `/scan?size=1.5L`.
- Allow camera.
- Capture a real bottle.
- Complete `/api/analyze`.
- Show the actual captured image and red line on `/result`.
- Confirm Supabase persisted the record.
- Confirm `/admin` can review and correct the record.
- Confirm manual upload creates the same kind of durable training record as camera capture or explicitly carry that proof into M006.

The latest live S17 evidence narrowed the blocker: health, prompt loading, and Gemini provider execution crossed the deployed Worker boundary, but Supabase persistence failed with an image-upload signature verification error. Treat this as a deployed Supabase service-role secret/config blocker before deeper code debugging.

### Test And Runtime Intent Readiness

The default local test gate is now reconciled with the intended runtime:

- Gemini unit tests mock direct `fetch` calls and do not hit external APIs.
- CV/ONNX route tests target local diagnostics apps, while deployed app-level routes assert intentional `501` responses.
- `/api/cv-analyze` and `/api/onnx-probe` remain local/staging diagnostics until a size/RSS/runtime proof says otherwise.
- README deployment steps use the explicit Windows-safe Wrangler command path.

### Accuracy Readiness

The current model path is not ready for accurate claims. The project has strong diagnostic infrastructure, but the latest sign-off says the fused CV/ONNX path is a NO-GO.

Conclusion, 2026-05-21: API-only is technically constrained now, but accuracy is still not good enough. The next best step is not more prompt-only work; it is using local/CV geometry to propose the liquid line, then asking the LLM to validate or explain evidence around that candidate. That means the LLM should stop being treated as the primary measuring instrument and should instead review candidate overlays, reject ambiguous images, and produce user-facing rationale when the local evidence is weak.

Required before accuracy claims:

- Better dataset labels and coverage.
- Model retraining or replacement.
- Repeated holdout sign-off that meets the 55ml primary tolerance.
- Separate metrics by fill level, lighting, angle, distance, and capture quality.
- Explicit reporting for cleaned natural images versus modified/augmented images, with no source-frame or augmented-variant leakage across train/validation/test splits.
- Candidate-line overlays saved for every evaluated frame so reviewers can see whether the failure came from bottle detection, line proposal, calibration, or LLM validation.

### Admin And Dataset Loop

The admin UI/API exists, but it needs a dedicated validation pass:

- Deployed admin routes should fail closed when `ADMIN_TOKEN` is absent or invalid.
- Approve/reject/correct statuses must map cleanly to training labels.
- Manual uploads must capture enough metadata for training.
- User correction deltas are now explicitly submitted and persisted for admin review when the result has an `analysisId`; M006 still needs deployed proof and dataset export rules.
- Dataset export/query should exclude rejected or uncertain records by default.

### Workflow Documentation Drift

The repo now has multiple historical plan layers:

- Stage 1 API-only roadmap.
- Stage 1.5 CV/ONNX GSD work.
- Older stripped plans.
- Current GSD state files.

The remaining milestones should explicitly treat M001-M004 as evidence-producing work, not as proof that the product is ready.

## BMad/GSD Workflow Implication

The project is not at "create a PRD from scratch." It is a brownfield correction and continuation point.

Recommended BMad/GSD routing:

1. Use these docs as the corrective-course planning packet.
2. Run sprint planning for M005.
3. Create one story/slice at a time.
4. Implement with tests before moving to the next slice.
5. Use code review and validation gates before marking a milestone complete.

Suggested BMad entries for the next implementation context:

| Menu | Skill | Use |
| --- | --- | --- |
| CC | `bmad-correct-course` | If the team wants to formally reconcile the NO-GO result with the roadmap before implementation. |
| SP | `bmad-sprint-planning` | Convert M005 into executable sprint/story order. |
| CS | `bmad-create-story` | Prepare the next specific story. |
| DS | `bmad-dev-story` | Implement the story and tests. |
| CR | `bmad-code-review` | Review the completed story. |
