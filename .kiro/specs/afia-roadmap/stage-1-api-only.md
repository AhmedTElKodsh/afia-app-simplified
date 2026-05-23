# Stage 1 - API-Only Product Validation

## Summary

Stage 1 uses only LLM/API-based analysis for oil-level estimation. Its job is to prove the user/admin workflow, establish the scan result contract, and collect a disciplined correction dataset before local-model work begins.

Stage 1.0 preserves the current eval-only Gemini capability spike. Later Stage 1 levels add the product shell, API service, result UI, Supabase/Admin loop, and field-quality gates while analysis remains API-driven.

Current review position, 2026-05-19: the user-facing outline is no longer planned as static-only. A functional guidance prototype exists and must be proven on real phones before it is treated as demo-ready. This does not change the Stage 1 analysis strategy: measurement remains API-first, and local/CV/ONNX paths are diagnostic until later gates pass.

## Levels

### Stage 1.0: Eval-Only Gemini Capability Spike

Validate whether Gemini can estimate remaining oil ml from controlled 1.5L bottle images.

Deliverables:

- Versioned prompt and few-shot assets.
- Strict JSON output parsing.
- Dev and holdout fixture manifests.
- JSONL eval runner and signoff gate.
- 55ml exact-bucket accuracy tracking for valid 1.5L images.

Exit gate:

- Eval run produces parseable results or recorded parse failures.
- Holdout accuracy and reviewer signoff justify building the API-only product workflow.

### Stage 1.1: QR/Product Identity and Cloudflare Capture Shell

Create the minimal deployed shell for scanning a product-specific link.

Deliverables:

- Mock QR/barcode generation for 1.5L, plus a 2.5L mock identity card that does not continue into the scan flow.
- Cloudflare-hosted scan URL that preserves product size.
- 1.5L as the only supported analysis path.
- 2.5L scan entry remains delayed; direct legacy 2.5L scan URLs must not analyze.

Exit gate:

- A phone can scan a 1.5L mock QR and reach the capture shell.
- Product identity is preserved through the flow.

### Stage 1.2: Camera Capture With Functional 1.5L Outline

Capture usable front-side bottle images from a modest distance, with the bottle fully visible while the phone is angled slightly downward toward a lower table surface.

Deliverables:

- Environment-facing camera request.
- Front-side instruction text.
- Upright 1.5L bottle outline guide that is smaller than the preview and leaves visible margin around the bottle.
- Instruction text that tells the user to hold the phone at standing hand height and angle it downward toward the bottle on the table.
- Layout that keeps outline clear of the camera button, upper text, language toggle, and theme toggle.
- Live guidance for move closer, move farther, lateral alignment, and phone angle adjustment.
- Red/orange/green guide state based on local frame analysis.
- Auto-lock and auto-capture only after a stable green match.
- Manual capture button and retake path as fallback.
- Basic client-side quality checks for very low resolution, poor lighting, overexposure, and very blurry/flat frames.

Exit gate:

- Users can capture a front-side 1.5L image on target mobile browsers.
- The guide does not imply a full-screen close-up or a sideways-tilted bottle; it encourages a smaller, fully visible bottle caused by the downward phone angle.
- Bad permissions and missing camera states show clear recovery messages.
- At least one Android and one iOS phone smoke confirm that the guide, floating controls, top copy, auto-capture, and manual fallback do not fight each other.

### Stage 1.3: API Analysis Service

Turn captured images into structured scan results using LLM APIs only.

Deliverables:

- `POST /api/analyze` product API.
- Gemini multi-key rotation for API-only analysis capacity.
- Optional OpenRouter routing only for explicitly configured image-capable models.
- Grok fallback for provider failure, quota exhaustion, or low-confidence API result.
- Stable scan result contract with remaining ml, consumed ml, red-line ratio, confidence, warnings, provider, and raw metadata.
- Logging of provider, prompt version, model version, and fallback reason.

Exit gate:

- Valid 1.5L captures return structured analysis results.
- Fallback behavior is deterministic and logged.

### Stage 1.4: Result UI, Slider, and Cup Counter

Make the API prediction inspectable and correctable.

Deliverables:

- Captured image shown with red horizontal oil-level line.
- Remaining ml and consumed ml displayed under the image.
- Left-side vertical slider initialized at the detected red line.
- Slider moves in 55ml increments.
- Slider stops at the last full 55ml step when remaining oil is less than the next full step.
- Cup counter below the slider shows quarter, half, three-quarter, and full cup states.
- User can accept, retake, or flag/correct the result.
- Submitted user corrections are stored for admin review when the analysis has a persisted record id.

Exit gate:

- Result screen communicates the model estimate clearly.
- A correction can be represented in the same 55ml unit system used by evaluation.
- Moving the slider never moves the fixed detected red line; it only records a correction candidate.

### Stage 1.5: Supabase/Admin Correction Dataset Loop

Convert every useful scan into training data for Stage 2.

Deliverables:

- Supabase image storage and analysis records.
- Admin review queue with image, product size, API result, confidence, warnings, and correction status.
- Admin actions for too high, too low, manual corrected ml, reject, and approve.
- Admin manual upload with product metadata and ground-truth ml.
- User-submitted slider corrections routed into pending admin review.
- Quality tags and label-source metadata preserved for training filters.
- Dataset export or query path for Stage 2 training, with trusted labels separated from rejected, pending, uncertain, or low-quality diagnostic records.

Exit gate:

- Every accepted/corrected image has clean product metadata and a usable label.
- Admin corrections are auditable and ready for local-model training.

### Stage 1.6: Field Pilot and Quality Gates

Measure real-world capture and API behavior before starting local-model work.

Deliverables:

- Pilot coverage across fill levels, lighting, distance, angle, background, and bottle condition.
- Capture quality tags for blur, glare, wrong side, partial bottle, poor framing, and unknown product.
- Accuracy report using 55ml as the primary tolerance for valid 1.5L images.
- Decision note: proceed to Stage 2, continue API-only iteration, or redesign.

Exit gate:

- Stage 1 has a disciplined correction dataset.
- Valid 1.5L images meet the agreed 55ml accuracy threshold.
- Invalid or low-quality images are rejected, flagged, or routed to fallback.
- The field pilot records Android/iOS camera behavior, permission failures, auto-capture reliability, manual fallback usage, lighting, glare, background, and wrong-side examples.

## Out of Stage 1

- Local model inference.
- Local model training.
- Local-only user path.
- Serious 2.5L analysis expansion beyond QR/product identity readiness.
- Production-grade auto-capture claims before real-phone calibration and field evidence.
