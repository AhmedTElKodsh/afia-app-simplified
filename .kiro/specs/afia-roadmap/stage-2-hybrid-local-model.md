# Stage 2 - Hybrid Local Model Development

## Summary

Stage 2 introduces a lightweight local model that can run in mobile browsers while LLM APIs remain available as fallback, evaluator, and development helper. The user-facing result contract should remain stable from Stage 1 so the analysis engine can change without redesigning the workflow.

Stage 2 should not begin until Stage 1 has a disciplined correction dataset.

## Levels

### Stage 2.0: Dataset Readiness

Prepare the Stage 1 data for local-model training and evaluation.

Deliverables:

- Consolidated dataset from real images, AI-augmented images, user corrections, admin corrections, and manual admin uploads.
- Clean labels for remaining ml, consumed ml, red-line ratio, product size, capture quality, and approval status.
- Train/validation/test split with 1.5L coverage across fill levels, lighting, angle, distance, and background.
- Augmentation rules for lighting, crop, blur, angle, and background variation.

Exit gate:

- Dataset quality is high enough to train a local baseline without mixing rejected or uncertain labels into trusted training data.

### Stage 2.1: Lightweight Local Model Baseline

Build the first mobile-browser-compatible model for the common 1.5L path.

Deliverables:

- Local model prototype that predicts oil level or the geometry needed to derive oil level.
- Browser runtime feasibility check for model size, load time, inference latency, and memory.
- Evaluation against held-out labeled images using the same 55ml tolerance.
- Model metadata: version, dataset version, metrics, known weaknesses.

Exit gate:

- Local model has measurable accuracy and performance on target mobile browsers.
- Baseline is good enough to compare against API predictions in a hybrid runtime.

### Stage 2.2: Hybrid Runtime With LLM Fallback

Use local inference first while keeping API analysis as support.

Deliverables:

- Local model runs before API analysis for supported 1.5L scans.
- Gemini/Grok fallback triggers when confidence is low, quality checks fail, product context is uncertain, or local/API disagreement is high.
- UI continues to show the same result fields from Stage 1.
- Analysis record stores local result, API fallback result, disagreement amount, confidence, and chosen final result.

Exit gate:

- Common valid 1.5L captures can complete locally.
- Fallback behavior improves trust instead of hiding model failure.

### Stage 2.3: Active Learning Loop

Turn uncertainty and disagreement into better training data.

Deliverables:

- Admin queue highlights low-confidence local predictions, API/local disagreements, and user-corrected results.
- Correction deltas are tracked by model version and dataset version.
- Failed captures and rejected samples are categorized for quality improvements.
- Dataset refresh process selects useful new examples for retraining.

Exit gate:

- New corrections measurably improve evaluation metrics or expose clear failure modes.

### Stage 2.4: Functional Outline, Quality Detection, and Auto-Capture Candidate

Use local image understanding to improve capture quality.

Deliverables:

- Quality checks for blur, glare, wrong side, partial bottle, poor framing, and tilt.
- Functional outline guidance for move closer, move farther, align bottle, and adjust angle.
- Optional auto-lock/auto-capture candidate only after guidance is reliable.
- Capture quality metadata stored with every scan.

Exit gate:

- Quality guidance reduces bad captures without blocking valid users unnecessarily.
- Auto-capture is allowed only if it improves accepted capture rate and does not reduce trust.

### Stage 2.5: Controlled 2.5L Expansion

Expand beyond 1.5L only after the 1.5L hybrid path is stable.

Deliverables:

- 2.5L product geometry and fixture/correction dataset.
- Separate evaluation metrics for 2.5L.
- No shared accuracy claim between 1.5L and 2.5L unless both pass independently.

Exit gate:

- 2.5L has enough labeled data and independent accuracy evidence to enter the supported product path.

## Out of Stage 2

- Removing API support from normal user scans.
- Launching local-only behavior without fallback.
- Treating 2.5L as equal to 1.5L before it has independent evidence.

