# M009 - Stage 3 Local-First Prelaunch

Status: planned

## Goal

Prepare the product for launch by making local inference the normal supported path and reducing API dependence to internal QA, admin review, or emergency diagnostics.

This milestone should start only after M008 proves the hybrid path works and the local model is trustworthy enough for common 1.5L scans.

## Depends On

- M008 hybrid runtime evidence.
- Stable admin monitoring and dataset loop.
- Model/version regression gates.
- Real-device performance evidence.

## Scope

In scope:

- Local-first or local-only 1.5L user path.
- Device/browser reliability matrix.
- Model versioning, rollback, and regression evals.
- Production-calibrated functional outline and optional auto-capture behavior.
- Production admin monitoring.
- Privacy, retention, and image-data handling decisions.
- Controlled 2.5L readiness planning after 1.5L is stable.

Out of scope:

- Expanding 2.5L analysis before independent evidence.
- Shipping a model without regression gates.
- Hiding uncertainty from users.

## Slices

### S31 - Local-First Candidate

Deliverables:

- Make local inference the default for supported 1.5L scans.
- Move API calls out of the normal happy path or behind internal/admin-only controls.
- Preserve correction and admin dataset flow.
- Add clear uncertain-result and retake states.

Acceptance criteria:

- Standard 1.5L scans can complete without external API inference.
- User trust states remain clear when local confidence is low.

Verification:

- Browser/mobile smoke with network throttled or API disabled.
- Result/admin tests for local-only provider metadata.

### S32 - Device And Browser Reliability

Deliverables:

- Test matrix for target phones, browsers, camera resolutions, memory limits, and network conditions.
- Budgets for app start, camera readiness, model load/cache, inference latency, and result rendering.
- Degraded behavior for unsupported browsers/devices.

Acceptance criteria:

- Target devices meet reliability and performance budgets.
- Unsupported devices receive a clear recovery path.

Verification:

- Manual device matrix.
- Browser-visible screenshots or recordings.
- Performance report.

### S33 - Functional Outline And Auto-Capture Hardening

Deliverables:

- Promote the Stage 1 functional outline prototype into production-calibrated quality guidance:
  - move closer
  - move farther
  - align bottle
  - adjust downward phone angle
  - wrong side warning
- Tune red/orange/green states using field evidence from accepted captures, rejected captures, and user/admin corrections.
- Keep manual capture available while auto-lock/auto-capture is hardened.

Acceptance criteria:

- Functional guidance reduces bad captures without blocking valid users.
- Auto-capture is enabled by default only if it improves accepted capture rate and does not increase surprise captures, missed bottles, or later corrections.

Verification:

- Capture-quality eval.
- Mobile UX tests.
- Field pilot comparison of manual vs guided capture.

### S34 - Model Governance And Rollback

Deliverables:

- Record model version, dataset version, training config, and metrics for every release candidate.
- Add regression suite across fill levels, lighting, angle, background, bottle condition, and quality tags.
- Define rollback process for bad model versions.
- Track correction drift after release.

Acceptance criteria:

- A model cannot ship without passing regression gates.
- Rollback can be performed without schema or UI changes.

Verification:

- Regression gate report.
- Rollback dry run.
- Admin monitoring check.

### S35 - Production Admin, Privacy, And Launch Gate

Deliverables:

- Admin monitoring for drift, correction rate, rejected captures, unsupported product attempts, and device failures.
- Privacy and retention policy for stored images and correction data.
- Launch/no-launch decision report.
- Controlled 2.5L expansion prerequisites.

Acceptance criteria:

- Launch decision includes accuracy, performance, reliability, monitoring, rollback, and privacy evidence.
- 2.5L is not treated as supported until it has independent dataset and sign-off metrics.

Verification:

- Launch gate report.
- Privacy/retention decision note.
- Monitoring dashboard or export proof.

## Milestone Exit Gate

M009 is complete only when:

- Local-first 1.5L path meets the 55ml tolerance target on launch-candidate data.
- Target devices pass reliability and performance budgets.
- Model update and rollback process is documented and tested.
- Admin monitoring can detect drift and correction spikes.
- Privacy and retention decisions are explicit.
- Launch/no-launch decision is recorded.

## Risks

| Risk | Mitigation |
| --- | --- |
| Local-only path fails on low-end phones. | Keep device matrix and performance budgets as hard gates. |
| Auto-capture frustrates users. | Ship functional guidance first; gate auto-capture behind evidence. |
| Model drift appears after field use. | Monitor correction rates and retrain from reviewed labels only. |
| 2.5L expansion dilutes focus. | Require independent 2.5L data, model metrics, and sign-off. |
