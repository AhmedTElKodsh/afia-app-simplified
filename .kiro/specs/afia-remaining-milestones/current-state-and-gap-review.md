# Afia Remaining Milestones - Current State And Gap Review

Updated: 2026-05-19

## Purpose

This document compares the current GSD/project state against the requested product workflow:

1. Product barcode or mock QR.
2. Cloudflare scan link.
3. Camera capture with front-side guidance and static outline first.
4. Optional basic quality detection.
5. Analysis through API models first, then a local model later with API fallback.
6. Result screen with real bottle image, red line, 55ml slider, and cup counter.

It is intentionally additive. Older plans remain useful history, but this review should be used to plan the remaining milestones.

## Source Priority

Use this source order when documents disagree:

1. Current code and tests in `web/`, `worker/`, and `packages/shared/`.
2. `.gsd/STATE.md`, completed slice summaries, and `runs/stage15-signoff/stage15-signoff.md`.
3. `.kiro/specs/afia-roadmap/*`.
4. Older stripped plans and historical GSD snapshots.

Important drift: `.gsd/PROJECT.md` still says M003/S09 is active, while `.gsd/STATE.md` says all recorded GSD milestones M001-M004 are complete. The slice summaries and sign-off artifacts support the `.gsd/STATE.md` view.

## Current GSD Status

| GSD milestone | Recorded outcome | Product meaning |
| --- | --- | --- |
| M001: Stage 1 Remediation & Accuracy Boost | Complete with gaps found. LLM prompt tuning failed. | Pure LLM vision was not accurate enough for oil-level regression. |
| M002: Heuristic Improvements & ONNX Feasibility | Complete. CV/ONNX infrastructure and eval path exist. | The project pivoted from prompt-only to CV/ONNX plus API support. |
| M003: ONNX Integration & Fusion | Complete, but business verdict is NO-GO. | Heuristic + ONNX + optional LLM fusion is wired, but accuracy is far below target. |
| M004: Validation & Test Coverage | Complete. Unit and integration-style tests added for CV/error surfaces. | Test coverage improved, but this does not make the model accurate. |

Current active requirements in `.gsd/REQUIREMENTS.md`:

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

## Workflow Comparison

| Requested workflow step | Achieved so far | Remaining gap |
| --- | --- | --- |
| 1. User scans Afia barcode or mock QR. Use separate 1.5L and 2.5L identities, focus analysis on 1.5L. | `MockQrPage`, `buildMockQrSvg`, `buildProductScanUrl`, and shared bottle constants support 1.5L and 2.5L mock QR identities. `ScanShell` preserves 2.5L identity but blocks analysis. | Real barcode/packaging QR is not integrated. 2.5L is identity-only and should remain unsupported for analysis until 1.5L succeeds. |
| 2. QR opens Cloudflare deployed link and prompts camera. | Cloudflare Worker route exists, SPA fallback exists, and previous live URL was `https://afia-stage1.savola.workers.dev`. `CaptureShell` requests environment-facing camera access. | The current dirty worktree and deployed runtime need a fresh phone smoke before claiming demo readiness. |
| 3. Camera opens on bottle front side with static outline first, later functional outline/autocapture. | `CaptureShell` has front-side copy, environment camera, manual capture, static transparent 1.5L outline, and downward-phone guidance. | Need mobile layout QA against floating controls and small screens. Functional outline, red/orange/green matching, move closer/farther guidance, auto-lock, and auto-capture are not implemented. |
| 4. Optional quality detection for lighting/resolution/blur. | CV route has validation/error surfaces and diagnostics, but the primary user path still depends on `/api/analyze`. | Basic client/server quality gates for blur, glare, wrong side, partial bottle, poor lighting, and bad framing are not productized. |
| 5. API analysis first, collect images/corrections, train local lightweight model, later local primary with API fallback. | `/api/analyze` calls Gemini with key rotation and Grok fallback, then persists to Supabase. `/api/cv-analyze` and ONNX/fusion diagnostics exist separately. Real and augmented image folders exist. | The primary user path is still API-first, while CV/ONNX is diagnostic and has a NO-GO accuracy verdict. A local model cannot become primary until dataset quality, retraining, and new sign-off metrics improve. |
| 6. Result shows actual scanned image with red line, remaining/consumed text, 55ml left slider, and cup counter. | `ResultShell` uses the actual camera raster image, fixed detected red line, left 55ml slider, and cup counter. `AdminShell` mirrors a red-line preview and supports manual corrected ml. | User-side correction is local UI state unless a follow-up persists it. Admin correction exists but GSD has not validated R002 as complete. |

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

### Accuracy Readiness

The current model path is not ready for accurate claims. The project has strong diagnostic infrastructure, but the latest sign-off says the fused CV/ONNX path is a NO-GO.

Required before accuracy claims:

- Better dataset labels and coverage.
- Model retraining or replacement.
- Repeated holdout sign-off that meets the 55ml primary tolerance.
- Separate metrics by fill level, lighting, angle, distance, and capture quality.

### Admin And Dataset Loop

The admin UI/API exists, but it needs a dedicated validation pass:

- Approve/reject/correct statuses must map cleanly to training labels.
- Manual uploads must capture enough metadata for training.
- User correction deltas should be persisted if the user-facing slider is part of the data loop.
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

