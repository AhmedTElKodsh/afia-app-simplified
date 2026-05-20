# M005 - Stage 1 Demo Stabilization

Status: active

Review update, 2026-05-19: M005 is not complete, but the local runtime/test reconciliation work is now complete. Shared, web, full Worker tests, web build, worker build, and `signoff:stage15` all run locally. Live S17 evidence still shows Supabase persistence is blocked by deployed project/secret configuration, and a real phone/admin proof is still required.

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
- Re-test functional capture outline, movement guidance, green lock, auto-capture, and manual fallback behavior on mobile-size viewports.
- Verify basic capture quality rejection for low resolution, poor lighting, overexposure/glare, and very blurry/flat frames.
- Verify `/api/analyze` uses API analysis and persists to Supabase.
- Verify result screen uses actual captured raster image and fixed detected red line.
- Verify result screen slider starts at the detected red line, moves in 55ml steps, clamps to the last full 55ml increment, and updates the quarter-cup display.
- Verify admin review can load, correct, and save the record.
- Verify manual upload is available as the M006 handoff path, or explicitly defer it to M006 with no ambiguity.
- Reconcile default Worker tests so the default test gate matches the deployed Stage 1 runtime.
- Require deployed admin authentication to fail closed when `ADMIN_TOKEN` is missing or unauthenticated.
- Reconcile current documentation/state drift enough that future work starts from the right place.

Out of scope:

- Training a new local model.
- Making CV/ONNX primary.
- Production-grade tuned outline/autocapture thresholds. The local heuristic exists now, but M005 must still prove it on real phone footage and M006 should collect field data for calibration.
- 2.5L analysis.
- Accuracy claims beyond the current documented NO-GO.
- Enabling CV/ONNX diagnostics in the production Worker. Those routes are currently intentionally disabled with `501` because of deployed Worker size/runtime constraints.

## Slices

### S14 - Test Gate And Runtime Intent Reconciliation

Status: completed locally on 2026-05-19.

Deliverables:

- Update stale Gemini unit tests so they mock `fetch` and never call external Google APIs.
- Split CV/ONNX route expectations from the default deployed Worker test suite, or test `worker/src/routes/cv-analyze.ts` through a local diagnostics-only app.
- Keep `/api/cv-analyze` and `/api/onnx-probe` returning clear `501` responses in the deployed Stage 1 Worker unless a separate staging/diagnostic Worker is introduced.
- Update the README deployment command so it uses the real Wrangler command instead of a missing `pnpm deploy` script.

Acceptance criteria:

- Default Worker tests are deterministic, offline, and aligned with the deployed Stage 1 runtime.
- Provider live probes are separate, secret-gated checks and are not unit tests.
- CV/ONNX diagnostic tests no longer imply that the production Worker supports those endpoints.

Verification:

- `pnpm.cmd --filter worker test` - pass.
- `pnpm.cmd --filter worker build` - pass.
- README deployment command review - updated to the explicit Wrangler path.

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
- Confirm functional outline is transparent, upright, sized for a smaller fully visible bottle, and does not cover capture button.
- Confirm the guide tells the user to move closer/farther or adjust phone angle when the detected silhouette does not match the outline.
- Confirm the guide turns green and auto-captures only after a stable match.
- Confirm top copy does not collide with language/theme controls on mobile layouts.
- Confirm behavior on at least one Android and one iOS device, or record why the smoke used a mobile-browser equivalent instead.
- Confirm red/orange/green state is supported by readable text, not color alone.
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
- Real Android/iOS phone smoke before demo-ready claim.

### S17 - Live Worker, Supabase, And Admin Proof

Status: next blocking slice.

Deliverables:

- Build current web assets for Worker asset serving.
- Verify Worker health route.
- Verify malformed `/api/analyze` returns expected error.
- Verify valid 1.5L capture reaches `/api/analyze`.
- Verify Supabase writes image and `analyses` row.
- Confirm the intended Supabase project/ref before rotating secrets, then refresh the deployed `SUPABASE_SERVICE_ROLE_KEY` for that configured project if live upload returns signature verification errors.
- Confirm unauthenticated admin access returns `401`, and confirm deployed admin auth is not fail-open when `ADMIN_TOKEN` is absent.
- Verify admin list sees the new record.
- Verify admin correction can set status, flag, corrected ml, and note.
- Verify result-screen user corrections submit to `/api/analyses/:id/user-correction` and appear as pending admin-reviewable labels.
- Verify admin manual upload creates a durable record or explicitly carry that proof into M006 as the first dataset slice.

Acceptance criteria:

- A real scan produces a persisted `analysisId`.
- Admin can load and correct the same record.
- Failures identify whether the issue is camera, API, provider, persistence, or admin auth.

Verification:

- `pnpm.cmd --filter web build`
- `pnpm.cmd --filter worker build`
- `pnpm.cmd --filter worker test`
- `pnpm.cmd --filter worker test worker/test/stage1-flow.test.ts worker/test/analyze-route.test.ts worker/test/admin-route.test.ts worker/test/supabase-storage.test.ts`
- Live checks against deployed Worker only after secrets are confirmed without exposing values.
- Deploy command: `npm.cmd exec --yes --package wrangler@latest -- wrangler deploy --config worker\wrangler.jsonc`

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

- Default shared, web, and Worker tests are green or explicitly split into documented default versus local-diagnostics suites.
- 1.5L mock QR flow works on a real phone or mobile browser-equivalent smoke.
- 2.5L identity is present but unsupported for analysis.
- Camera capture produces a real image.
- `/api/analyze` returns a structured result or a clear failure.
- Result screen uses the actual captured image and red line.
- Supabase persistence is verified.
- Admin auth fails closed in deployed mode.
- Admin can review and save a correction.
- Documentation states that accuracy remains a separate NO-GO gate.

## Risks

| Risk | Mitigation |
| --- | --- |
| Live Worker secrets drift. | Audit secret names against `worker/src/env.ts` and verify behavior through endpoints without printing values. |
| Browser tests pass but phone camera fails. | Require phone or mobile browser-visible smoke before exit. |
| Model accuracy distracts from workflow proof. | Treat all accuracy output as diagnostic during M005. |
| Existing worktree changes are unrelated. | Do not revert user/runtime changes; isolate docs and targeted fixes. |
