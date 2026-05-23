# M007 - Stage 2 Model Foundation And Accuracy Remediation

Status: planned

Review update, 2026-05-19: do not treat ONNX/CV as production-proven. Local CV/ONNX/scoring modules and eval artifacts exist, but the deployed Stage 1 Worker currently returns `501` for `/api/cv-analyze` and `/api/onnx-probe`. M007 begins from a dataset-backed remediation position, with Worker-size/RSS/parity proof still required before any hybrid runtime claim.

Research/party-mode update, 2026-05-21: API-only is technically constrained now, but accuracy is still not good enough. The next best step is not more prompt-only work; it is using local/CV geometry to propose the liquid line, then asking the LLM to validate or explain evidence around that candidate. Current local CV/ONNX also remains below product accuracy, so M007 must improve the evidence pipeline before it promotes any runtime path.

## Goal

Use the corrected dataset to build a better local/CV model candidate.

This milestone exists because the current Stage 1.5 fusion result is a NO-GO. The goal is to earn the right to proceed to hybrid runtime, not to assume that ONNX/CV is ready.

## Depends On

- M006 trusted dataset and field-pilot records.
- Existing CV/ONNX/fusion infrastructure.
- Existing real and augmented image folders.
- Existing eval/sign-off runners, with the consolidated Stage 1.5 NO-GO metrics in `current-state-and-gap-review.md` and `../afia-project-reference/legacy-planning-archive.md` as the current historical accuracy source.

## Scope

In scope:

- Build clean train/validation/test manifests.
- Separate real captured images from augmented images.
- Treat cleaned natural images as the decision-grade evaluation source and modified/augmented images as training robustness or stress-test inputs until natural-image metrics improve.
- Add source-image/session grouping and near-duplicate checks so augmented variants of one source never cross train/validation/test boundaries.
- Build a candidate-line proposal engine that returns bottle bounds, bottle axis, usable container top/base, top liquid-line candidates, scores, and rejection reasons.
- Generate annotated overlays for every evaluation image.
- Ask the LLM to validate or reject candidate overlays instead of asking it to invent a measurement from the full image.
- Train or generate model candidates suitable for browser/Worker runtime.
- Compare candidate approaches against the current heuristic + ONNX baseline.
- Prove candidate runtime compatibility separately from local Node success: bundle size, Worker route behavior, RSS/memory, and parity.
- Preserve reproducible model metadata.
- Decide whether to proceed, continue remediation, or change approach.

Out of scope:

- Making local model primary in production.
- Removing API fallback.
- 2.5L support.
- Launch readiness.

## Candidate Approaches

Evaluate candidates pragmatically:

| Candidate | Why consider it | Gate |
| --- | --- | --- |
| Candidate-line contour/geometry pipeline | Lowest runtime cost and easiest to debug; should propose several liquid-line candidates instead of one forced answer. | Must beat current NO-GO by a meaningful margin on cleaned natural images and save overlays for failures. |
| Retrained ONNX regression model | Fits existing Stage 1.5 infrastructure. | Must meet runtime memory and accuracy targets. |
| Lightweight segmentation or keypoint model | Better suited to oil surface/meniscus localization than direct ml regression. | Must run in target browser/Worker budget. |
| API-assisted labeling/evaluator | Useful for dataset triage, overlay validation, and explanation, not primary measurement. | Must not be treated as ground truth without admin review or candidate geometry. |

## Image And Capture Factors To Stratify

Every M007 eval report should break out performance by the factors most likely to move the line estimate:

- Fill band: empty/low/mid/high/full, especially nonlinear shoulder/base regions.
- Source: cleaned natural, modified/augmented, manual admin upload, user capture, and synthetic diagnostic.
- Capture geometry: distance, bottle scale in frame, vertical axis tilt, camera angle, crop/edge contact, and perspective distortion.
- Visibility: full bottle, top/base visible, label occlusion, hand occlusion, cap state, dents/squeezed bottle, and wrong side.
- Lighting: front light, back light, side light, glare, dark frame, overexposure, shadows, and glossy counters.
- Background: plain matte, busy kitchen, low contrast, similar yellow/green/red hues, and reflective surfaces.
- Image quality: blur, focus, compression artifacts, resolution, motion, and sensor noise.
- Liquid evidence: meniscus visibility, slanted liquid surface, bubbles/foam, residue on bottle wall, color saturation, and internal reflection bands.

## Technique Backlog

Prioritize these experiments before training a heavier model:

1. Normalize the bottle ROI with rotation/perspective correction when top/base/axis confidence is high enough.
2. Generate candidate lines from Hough/near-horizontal segments, Sobel/Canny edge bands, vertical projection profiles, color/intensity discontinuities, and local standard-deviation changes inside the bottle mask.
3. Score candidate lines by horizontal continuity, edge strength, position inside the bottle mask, separation between oil/air regions, stability across preprocessing variants, and geometric plausibility.
4. Convert the selected line to ml using a 1.5L bottle profile curve rather than assuming perfectly linear height when calibration data exists.
5. Compare classical CV masks against lightweight segmentation or keypoint candidates, including YOLO segmentation/pose, MobileSAM/SAM-assisted labeling, TensorFlow.js transfer learning, and ONNX Runtime Web export.
6. Add a small quality classifier or deterministic quality score that rejects impossible frames before estimating ml.
7. Use active-learning queues for high-disagreement, low-confidence, and high-user-correction samples.
8. Keep LLM validation structured: selected candidate, accept/reject, visible issues, confidence, and explanation.

## Slices

### S23 - Dataset Manifest And Split

Deliverables:

- Create canonical dataset manifest from Supabase/export plus local image folders.
- Mark each record as real, augmented, manual upload, user correction, or admin correction.
- Split into train/validation/test with no near-duplicate leakage.
- Balance across fill bands, quality tags, backgrounds, and capture devices.
- Preserve source image/session ids for modified/augmented images so split tooling can group related frames.
- Add fields for cleaned-natural versus modified-augmented source class, capture geometry, lighting/background tag, and whether the liquid line is visible.

Acceptance criteria:

- Model training can run from manifests rather than ad hoc folders.
- Holdout images are protected from tuning.
- Natural-only and augmented-only summaries are reported separately.

Verification:

- Manifest validation script.
- Duplicate/near-duplicate check.
- Summary report by fill band and quality tag.
- Leakage check proving no augmented derivative shares a source with another split.

### S24 - Baseline Reproduction

Deliverables:

- Re-run current heuristic + ONNX + fusion baseline on the new dataset.
- Record per-band failures.
- Confirm the old NO-GO behavior is reproduced or explain differences.

Acceptance criteria:

- The team knows the true starting metric before model changes.

Verification:

- `pnpm.cmd --filter worker eval:edge` or successor dataset eval.
- Sign-off artifact with exact/close accuracy, MAE, RMSE, and failure buckets.

### S25 - Candidate Model Training

Deliverables:

- Build and evaluate the candidate-line proposal engine before training a heavier model.
- Train at least one local-compatible candidate only after baseline candidate-line failures are understood.
- Record training config, dataset version, model version, and metrics.
- Export to runtime-compatible format.
- Add fixture tests for model loading and inference shape.
- Add Worker/staging proof before calling any candidate deployable.

Acceptance criteria:

- Candidate model runs in local test/runtime constraints.
- Candidate model has a credible Worker/browser runtime path, not only a Node eval path.
- Metrics are measured on validation and untouched test sets.

Verification:

- Training log and model metadata.
- ONNX/browser runtime smoke.
- Worker-size, RSS, and endpoint/parity checks in a staging or diagnostic runtime.
- Unit tests for loader and inference shape.
- Overlay artifact review for line proposal, LLM validation, and rejection behavior.

### S26 - Accuracy Sign-off Decision

Deliverables:

- Repeat sign-off on the holdout/test set.
- Compare exact 55ml, close 110ml, MAE, RMSE, and failure distribution.
- Decide:
  - proceed to M008
  - continue model remediation
  - redesign measurement approach

Acceptance criteria:

- No hybrid runtime work starts unless the model has evidence that it can improve the product.
- If still NO-GO, the report states the next remediation hypothesis.

Verification:

- Sign-off JSON and Markdown.
- Reviewable decision note.

## Milestone Exit Gate

M007 is complete only when one of these is true:

- A local-compatible candidate passes the agreed 55ml accuracy gate and can move to M008.
- Or the milestone records a formal NO-GO with evidence and a next remediation plan.

## Risks

| Risk | Mitigation |
| --- | --- |
| Augmented images dominate the model. | Split and report real/augmented metrics separately. |
| Holdout leakage inflates accuracy. | Lock protected test split before training. |
| Direct ml regression remains unstable. | Evaluate segmentation/keypoint alternatives. |
| Runtime-compatible model is too large. | Include size, load time, memory, and latency gates early. |
