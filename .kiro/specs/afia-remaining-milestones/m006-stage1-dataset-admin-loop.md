# M006 - Stage 1 Dataset And Admin Loop

Status: planned

Review update, 2026-05-19: M006 should start only after M005 proves a persisted, admin-reviewable live record. The local code now fails admin auth closed, validates admin correction ml on the 55ml scale, expands quality tags, stores manual uploads as `manual` provider records with red-line semantics, and exposes a user correction submit path. It is still not a validated dataset loop until deployed persistence/admin proof and export/query rules exist.

## Goal

Turn the working Stage 1 workflow into a reliable correction dataset for future model training.

The main question is not "is the model accurate yet?" The question is "can every scan, correction, and admin upload become trusted training evidence?"

## Depends On

- M005 live demo stabilization.
- Supabase `analysis-images` storage and `analyses` table.
- Existing `/admin` review queue and manual upload UI.
- Existing correction fields in shared schemas and Worker admin routes.

## Scope

In scope:

- Validate and complete R002: admin review and correction interface.
- Require deployed admin routes to fail closed when `ADMIN_TOKEN` is missing or invalid.
- Persist user correction deltas through the explicit result-screen submit action and route them into admin review.
- Add or confirm admin actions: too high, too low, manual corrected ml, approve, reject.
- Add quality tags needed for training: blur, glare, wrong side, partial bottle, poor framing, poor lighting, unsupported product, uncertain label.
- Preserve capture quality signals from both the user path and diagnostics path so training can filter bad examples without deleting them.
- Add dataset export/query path for training.
- Define dataset inclusion/exclusion rules.
- Build a field-pilot collection checklist.

Out of scope:

- Training the local model.
- Local primary runtime.
- 2.5L accuracy support.
- Auto-capture.

## Slices

### S19 - Admin Correction Contract Validation

Status: partially implemented locally; needs live validation.

Deliverables:

- Confirm all correction statuses and flags are represented in shared schemas.
- Confirm admin PATCH validates ml range, 55ml step expectations, and allowed statuses.
- Confirm admin preview shows the same red-line semantics as the user result screen.
- Confirm auth failure paths are clear, secret-safe, and fail closed in deployed mode.

Acceptance criteria:

- Admin can approve, reject, mark too high/too low, set corrected ml, and add a note.
- Invalid correction payloads fail clearly.
- Missing or invalid `ADMIN_TOKEN` cannot expose admin records in deployed mode.
- GSD R002 can be marked validated by tests and live proof.

Verification:

- `pnpm.cmd --filter @afia/shared test`
- `pnpm.cmd --filter worker test worker/test/admin-route.test.ts worker/test/stage1-flow.test.ts`
- `pnpm.cmd --filter web test web/test/admin-shell.test.tsx`

### S20 - User Correction Persistence

Status: implemented locally; needs deployed proof and admin queue review.

Deliverables:

- Treat the result slider as local-only until the user explicitly presses the accept/submit correction action.
- Persist the submitted corrected ml against the original `analysisId`.
- Preserve the original API result and route the corrected ml into pending admin review instead of silently trusting it.
- Route submitted corrections into admin review instead of silently trusting them.

Acceptance criteria:

- User movement of the slider does not silently alter the model result.
- Any submitted user correction is auditable and tied to the original analysis.

Verification:

- Component tests for the result correction action.
- Worker route tests for user correction persistence if a new endpoint is added.
- Admin queue shows user-submitted corrections distinctly from admin manual corrections.

Implemented local evidence:

- `POST /api/analyses/:id/user-correction` validates `correctedRemainingMl`, `acceptedEstimate`, and optional note through shared schemas.
- User corrections update `correction_status=pending_review`, preserve review gating, and store corrected ml in the existing correction fields.
- `ResultShell` posts corrections only when an `analysisId` exists.
- Manual admin uploads now use provider `manual` and compute red-line position from the supplied ground-truth ml.

### S21 - Dataset Export And Label Rules

Deliverables:

- Define trusted label rules:
  - approved admin label
  - manual upload with known ground truth
  - rejected sample excluded from training
  - uncertain sample kept for diagnostics only
- Add export/query path for training manifests.
- Include image reference, product size, remaining ml, consumed ml, red-line ratio, capture quality tags, provider/model metadata, correction status, and label source.
- Include correction source semantics: model prediction, user-submitted correction, admin correction, or manual ground-truth upload.
- Use the consolidated Stage 1.5 NO-GO metrics in `current-state-and-gap-review.md` and `../afia-project-reference/legacy-planning-archive.md` as the historical accuracy baseline until new reviewer decisions are deliberately mirrored into `runs/signoffs.jsonl`.
- Ensure exports do not include secrets.

Acceptance criteria:

- A training script can consume the dataset without manually filtering rejected records.
- Every row has a clear label status and source.

Verification:

- Unit tests for export filtering rules.
- Sample export generated from fixture data.
- Manual inspection of exported fields.

### S22 - Field Pilot Collection Plan

Deliverables:

- Define minimum capture matrix:
  - fill levels every 55ml or representative bands
  - lighting conditions
  - glare/backgrounds
  - distance and downward phone angle
  - partial bottle/wrong side negative examples
  - different phone/browser combinations
- Define reviewer workflow for labeling and quality tags.
- Define target dataset size for the next model attempt.
- Define Stage 2 outline/autocapture data requirements: bottle mask/shape fit, distance guidance, downward angle guidance, red/orange/green lock state, and automatic capture confidence threshold.

Acceptance criteria:

- The next model milestone starts with a known dataset target, not an open-ended image folder.
- Invalid and rejected images are useful diagnostics but not mixed into training labels.

Verification:

- Field-pilot checklist reviewed.
- Dataset schema supports all planned metadata.

## Milestone Exit Gate

M006 is complete only when:

- Admin correction is validated end to end.
- User correction behavior is decided and implemented if needed.
- Manual uploads produce training-ready records.
- Dataset export/query path exists.
- Dataset rules prevent rejected/uncertain labels from contaminating training.
- Field pilot plan is ready to collect the next model dataset.

## Risks

| Risk | Mitigation |
| --- | --- |
| Corrections become ambiguous labels. | Store label source, correction status, admin note, and quality tags. |
| User slider changes are mistaken for model predictions. | Keep original prediction immutable and store corrections separately. |
| Manual uploads miss metadata. | Require product size, remaining ml, source, and quality fields. |
| Dataset grows but remains biased. | Use the field-pilot matrix before training. |
