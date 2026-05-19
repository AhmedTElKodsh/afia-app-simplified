# M005 - Stage 1 Demo Stabilization

Status: planned

## Goal

Stabilize the existing Stage 1 product loop so it can be demoed honestly on a real phone:

`Mock QR -> Cloudflare scan link -> camera capture -> API analysis -> result screen -> Supabase persistence -> admin review/correction`

This milestone does not try to solve model accuracy. It proves that the current product workflow is wired, observable, and safe to demo as a prototype.

## Depends On

- M001 evidence that pure LLM prompting is not enough for accuracy.
- M002-M004 CV/ONNX/test infrastructure.
- Existing Stage 1 web/Worker/Admin implementation.
- Current Cloudflare Worker and Supabase configuration.

## Scope

In scope:

- Verify separate 1.5L and 2.5L mock QR identities.
- Keep 1.5L as the only analysis-supported bottle.
- Verify 2.5L shows pending/unsupported analysis.
- Re-test static capture outline and manual capture behavior on mobile-size viewports.
- Verify `/api/analyze` uses API analysis and persists to Supabase.
- Verify result screen uses actual captured raster image and fixed detected red line.
- Verify admin review can load, correct, and save the record.
- Reconcile current documentation/state drift enough that future work starts from the right place.

Out of scope:

- Training a new local model.
- Making CV/ONNX primary.
- Functional outline/autocapture.
- 2.5L analysis.
- Accuracy claims beyond the current documented NO-GO.

## Slices

### S15 - Product Identity And Scan Link Proof

Deliverables:

- Confirm `/mock-qr` renders separate 1.5L and 2.5L cards.
- Confirm each QR/link encodes `/scan?size=<size>`.
- Confirm `/scan?size=1.5L` opens the capture shell.
- Confirm `/scan?size=2.5L` preserves product identity but blocks analysis.
- Confirm missing or invalid size shows a clear error, not a fallback to 1.5L.

Acceptance criteria:

- 1.5L and 2.5L identities are distinct in DOM and generated QR metadata.
- Only 1.5L reaches capture.
- Invalid scan links are explicit errors.

Verification:

- `pnpm.cmd --filter @afia/shared test`
- `pnpm.cmd --filter web test web/test/mock-qr.test.tsx web/test/scan-shell.test.tsx`
- Browser smoke of `/mock-qr`, `/scan?size=1.5L`, `/scan?size=2.5L`, and `/scan?size=bad`.

### S16 - Mobile Capture And Result UX Proof

Deliverables:

- Confirm camera permission, missing-camera, blocked-camera, capture-failed, analyzing, and analysis-failed states.
- Confirm static outline is transparent, upright, sized for a smaller fully visible bottle, and does not cover capture button.
- Confirm top copy does not collide with language/theme controls on mobile layouts.
- Confirm capture writes a real camera raster data URL, not a placeholder SVG.
- Confirm result page rejects non-raster fake captures.
- Confirm red line is rendered inside the same image wrapper as the displayed bottle image.
- Confirm slider starts at detected red line and then moves independently as correction control.
- Confirm 55ml increments and cup counter labels.

Acceptance criteria:

- A user can manually capture a front-side 1.5L bottle image.
- The captured image shown on result is the actual scan.
- The detected red line stays fixed while the correction thumb moves.

Verification:

- `pnpm.cmd --filter web test web/test/capture-shell.test.tsx web/test/result-shell.test.tsx web/test/stage1-client-flow.test.tsx`
- Browser-visible checks at mobile and desktop sizes.

### S17 - Live Worker, Supabase, And Admin Proof

Deliverables:

- Build current web assets for Worker asset serving.
- Verify Worker health route.
- Verify malformed `/api/analyze` returns expected error.
- Verify valid 1.5L capture reaches `/api/analyze`.
- Verify Supabase writes image and `analyses` row.
- Verify admin list sees the new record.
- Verify admin correction can set status, flag, corrected ml, and note.

Acceptance criteria:

- A real scan produces a persisted `analysisId`.
- Admin can load and correct the same record.
- Failures identify whether the issue is camera, API, provider, persistence, or admin auth.

Verification:

- `pnpm.cmd --filter web build`
- `pnpm.cmd --filter worker build`
- `pnpm.cmd --filter worker test worker/test/stage1-flow.test.ts worker/test/analyze-route.test.ts worker/test/admin-route.test.ts worker/test/supabase-storage.test.ts`
- Live checks against deployed Worker only after secrets are confirmed without exposing values.

### S18 - GSD And Roadmap Reconciliation

Deliverables:

- Document that M001-M004 are complete evidence milestones, not product-readiness proof.
- Record Stage 1.5 accuracy as NO-GO.
- Map M005 completion evidence to the remaining active requirements.
- Preserve older docs as history, but link future work to this remaining-milestones plan.

Acceptance criteria:

- A future agent can answer "what is next?" without reopening stale M003/S09 state.
- The plan distinguishes demo readiness, dataset readiness, and accuracy readiness.

Verification:

- Manual doc review.
- `git diff -- .kiro/specs/afia-remaining-milestones`

## Milestone Exit Gate

M005 is complete only when all of these are true:

- 1.5L mock QR flow works on a real phone or mobile browser-equivalent smoke.
- 2.5L identity is present but unsupported for analysis.
- Camera capture produces a real image.
- `/api/analyze` returns a structured result or a clear failure.
- Result screen uses the actual captured image and red line.
- Supabase persistence is verified.
- Admin can review and save a correction.
- Documentation states that accuracy remains a separate NO-GO gate.

## Risks

| Risk | Mitigation |
| --- | --- |
| Live Worker secrets drift. | Audit secret names against `worker/src/env.ts` and verify behavior through endpoints without printing values. |
| Browser tests pass but phone camera fails. | Require phone or mobile browser-visible smoke before exit. |
| Model accuracy distracts from workflow proof. | Treat all accuracy output as diagnostic during M005. |
| Existing worktree changes are unrelated. | Do not revert user/runtime changes; isolate docs and targeted fixes. |

