# Metrics and Gates

## Accuracy Defaults

- Primary tolerance: **within 55ml** for valid 1.5L images.
- 55ml represents one quarter cup increment and matches the result slider step.
- A wider tolerance may be tracked as diagnostic information, but it is not the primary planning gate.
- Accuracy should be reported separately by product size, fill level, lighting, angle, distance, background, and capture quality.

## Capture Quality Rules

Invalid or low-quality captures must not be silently trusted.

The system should reject, flag, or route to fallback when it detects:

- Very blurry image.
- Poor lighting or heavy glare.
- Bottle not fully visible.
- Wrong side of bottle.
- Strong tilt or bad angle.
- Product size mismatch.
- Unsupported bottle size.
- Confidence below the stage-specific threshold.

## Stage Progression Gates

### Stage 1 to Stage 2

Stage 2 cannot begin until Stage 1 has:

- End-to-end 1.5L API-only workflow evidence.
- Stored images, metadata, API predictions, and corrections.
- Admin-reviewed labels suitable for training.
- Field pilot coverage across common capture conditions.
- 55ml accuracy evidence for valid 1.5L images.
- A decision note approving local-model development.

### Stage 2 to Stage 3

Stage 3 cannot begin until Stage 2 has:

- Local model baseline with measurable accuracy and mobile/browser performance.
- Hybrid runtime evidence showing when local prediction is safe and when fallback is needed.
- Active-learning loop that improves or explains model performance.
- Quality checks that reduce bad captures.
- Dataset and model versioning discipline.

### Stage 3 to Launch

Launch cannot proceed until Stage 3 has:

- Local-first or local-only path meeting the 55ml tolerance target for valid supported scans.
- Device/browser reliability on target mobile environments.
- Model regression gates and rollback process.
- Admin monitoring for drift, correction rate, and rejected captures.
- Clear unsupported/uncertain scan recovery UX.
- Privacy and data-retention decisions documented.

## Minimum Records to Preserve

Across all stages, scan and evaluation records should preserve enough information to debug and train later:

- Product size.
- Image or image reference.
- Remaining ml and consumed ml.
- Red-line ratio.
- Confidence and warnings.
- Provider/model/runtime used.
- Prompt/model/dataset version where applicable.
- User/admin correction.
- Capture quality tags.
- Final accepted label status.

