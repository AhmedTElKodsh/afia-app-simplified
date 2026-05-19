# M006 - Stage 1 Dataset And Admin Loop

Status: planned

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
- Persist user correction deltas if the result slider is intended to feed training.
- Add or confirm admin actions: too high, too low, manual corrected ml, approve, reject.
- Add quality tags needed for training: blur, glare, wrong side, partial bottle, poor framing, poor lighting, unsupported product, uncertain label.
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

Deliverables:

- Confirm all correction statuses and flags are represented in shared schemas.
- Confirm admin PATCH validates ml range, 55ml step expectations, and allowed statuses.
- Confirm admin preview shows the same red-line semantics as the user result screen.
- Confirm auth failure paths are clear and secret-safe.

Acceptance criteria:

- Admin can approve, reject, mark too high/too low, set corrected ml, and add a note.
- Invalid correction payloads fail clearly.
- GSD R002 can be marked validated by tests and live proof.

Verification:

- `pnpm.cmd --filter @afia/shared test`
- `pnpm.cmd --filter worker test worker/test/admin-route.test.ts worker/test/stage1-flow.test.ts`
- `pnpm.cmd --filter web test web/test/admin-shell.test.tsx`

### S20 - User Correction Persistence

Deliverables:

- Decide whether the result slider is only a personal correction aid or also a data-submission control.
- If it feeds the dataset, add an explicit save/submit correction action.
- Persist correction delta with original API result, corrected ml, red-line ratio, and capture metadata.
- Route submitted corrections into admin review instead of silently trusting them.

Acceptance criteria:

- User movement of the slider does not silently alter the model result.
- Any submitted user correction is auditable and tied to the original analysis.

Verification:

- Component tests for the result correction action.
- Worker route tests for user correction persistence if a new endpoint is added.
- Admin queue shows user-submitted corrections distinctly from admin manual corrections.

### S21 - Dataset Export And Label Rules

Deliverables:

- Define trusted label rules:
  - approved admin label
  - manual upload with known ground truth
  - rejected sample excluded from training
  - uncertain sample kept for diagnostics only
- Add export/query path for training manifests.
- Include image reference, product size, remaining ml, consumed ml, red-line ratio, capture quality tags, provider/model metadata, correction status, and label source.
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

