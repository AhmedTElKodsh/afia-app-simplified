# Stage 1 - API-Only Product Validation

## Summary

Stage 1 uses only LLM/API-based analysis for oil-level estimation. Its job is to prove the user/admin workflow, establish the scan result contract, and collect a disciplined correction dataset before local-model work begins.

Stage 1.0 preserves the current eval-only Gemini capability spike. Later Stage 1 levels add the product shell, API service, result UI, Supabase/Admin loop, and field-quality gates while analysis remains API-driven.

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

- Mock QR/barcode generation for 1.5L and 2.5L.
- Cloudflare-hosted scan URL that preserves product size.
- 1.5L as the only supported analysis path.
- 2.5L route displays a clear unsupported/pending message.

Exit gate:

- A phone can scan a 1.5L mock QR and reach the capture shell.
- Product identity is preserved through the flow.

### Stage 1.2: Camera Capture With Static 1.5L Outline

Capture usable front-side bottle images manually from a modest distance, with the bottle fully visible while the phone is angled slightly downward toward a lower table surface.

Deliverables:

- Environment-facing camera request.
- Front-side instruction text.
- Static upright 1.5L bottle outline guide that is smaller than the preview and leaves visible margin around the bottle.
- Instruction text that tells the user to hold the phone at standing hand height and angle it downward toward the bottle on the table.
- Layout that keeps outline clear of the camera button, upper text, language toggle, and theme toggle.
- Manual capture button and retake path.

Exit gate:

- Users can capture a front-side 1.5L image on target mobile browsers.
- The guide does not imply a full-screen close-up or a sideways-tilted bottle; it encourages a smaller, fully visible bottle caused by the downward phone angle.
- Bad permissions and missing camera states show clear recovery messages.

### Stage 1.3: API Analysis Service

Turn captured images into structured scan results using LLM APIs only.

Deliverables:

- `POST /api/analyze` product API.
- Gemini multi-key rotation for API-only analysis capacity.
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

Exit gate:

- Result screen communicates the model estimate clearly.
- A correction can be represented in the same 55ml unit system used by evaluation.

### Stage 1.5: Supabase/Admin Correction Dataset Loop

Convert every useful scan into training data for Stage 2.

Deliverables:

- Supabase image storage and analysis records.
- Admin review queue with image, product size, API result, confidence, warnings, and correction status.
- Admin actions for too high, too low, manual corrected ml, reject, and approve.
- Admin manual upload with product metadata and ground-truth ml.
- Dataset export or query path for Stage 2 training.

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

## Out of Stage 1

- Local model inference.
- Local model training.
- Local-only user path.
- Serious 2.5L analysis expansion beyond QR/product identity readiness.
- Auto-capture as a required behavior.
