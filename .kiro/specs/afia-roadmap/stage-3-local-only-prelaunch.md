# Stage 3 - Local-First and Local-Only Prelaunch

## Summary

Stage 3 hardens the product for launch by making local inference the normal user path. LLM APIs may remain for internal QA, admin review, or emergency diagnostics, but they should not be required for standard supported scans.

## Levels

### Stage 3.0: Local-First Candidate

Make local inference the default analysis path for supported bottles.

Deliverables:

- Local model handles valid 1.5L scans without external LLM calls.
- API calls are disabled for normal user flow or hidden behind internal/admin-only controls.
- Result UI remains consistent with Stage 1 and Stage 2.
- Corrections still flow into Admin review and dataset monitoring.

Exit gate:

- Local-only 1.5L path meets the 55ml tolerance target on the launch candidate dataset.

### Stage 3.1: Device and Browser Reliability

Prove the local path works on real target devices.

Deliverables:

- Test matrix for target phones, browsers, camera resolutions, memory limits, and network states.
- Performance budgets for model download/cache, app start, camera readiness, and inference latency.
- Graceful degraded behavior for unsupported browsers/devices.

Exit gate:

- Target devices meet reliability and performance budgets without requiring API inference.

### Stage 3.2: Model Versioning and Regression Evals

Make local model updates safe.

Deliverables:

- Model version, dataset version, training config, and metrics recorded for every release candidate.
- Regression suite covering fill levels, lighting, angle, backgrounds, bottle condition, and capture quality.
- Rollback plan for bad model versions.
- Model-drift monitoring plan based on admin corrections and field failures.

Exit gate:

- A new model version cannot ship without passing regression gates and rollback readiness.

### Stage 3.3: Local-Only UX and Recovery

Keep the user path trustworthy when APIs are absent.

Deliverables:

- Clear messages for unsupported bottle, poor image quality, uncertain result, and retake needed.
- Local quality detection blocks or warns on bad captures.
- Correction flow works even if network is delayed, with sync when available if persistence is required.
- Admin receives enough metadata to investigate edge cases.

Exit gate:

- Users can recover from failed scans without API fallback or hidden manual intervention.

### Stage 3.4: Production Admin and Launch Gate

Prepare the operational side for prelaunch.

Deliverables:

- Admin monitoring for model errors, drift, correction rate, rejected captures, and unsupported product attempts.
- Launch dashboard or report covering accuracy, latency, correction rate, fallback/API usage if any, and device reliability.
- Privacy and retention decisions for stored images and correction data.
- Final launch/no-launch decision record.

Exit gate:

- Product is launch-ready only when accuracy, performance, reliability, admin monitoring, and privacy gates are all satisfied.

## Out of Stage 3

- New speculative model architectures without evidence from Stage 2.
- Expanding product sizes before launch candidate reliability is proven.
- Relying on LLM APIs for normal supported scans.

