# Stage 2 Local Model Requirements

## Purpose

This spec defines what must be true before a local browser/mobile model can become the primary analysis path. After reading it, a future implementer should know that Stage 2 starts from reviewed data and accuracy gates, not from the existence of CV or ONNX code alone.

## Entry Conditions

Stage 2 may start only after Stage 1 has:

- A deployed 1.5L phone-to-admin trace with a persisted analysis id.
- Supabase image and analysis persistence working in the deployed environment.
- Admin review and correction proven on a live record.
- Manual uploads producing durable records or a first M006 slice dedicated to proving them.
- Dataset rules that distinguish model prediction, user correction, admin correction, manual ground truth, rejected sample, and uncertain diagnostic sample.
- Current Stage 1 accuracy recorded honestly, including any NO-GO verdict.

## Dataset Requirements

The training dataset must include:

- Real captured images from the product flow.
- Admin-reviewed corrections and manual ground-truth uploads.
- User-submitted slider corrections as review candidates, not automatic ground truth.
- AI-augmented images only when their relationship to real images is recorded.
- Product size, remaining ml, consumed ml, red-line ratio, label source, confidence, provider/model metadata, prompt/model/dataset version, and quality tags.
- Train/validation/test split with no near-duplicate leakage.
- Separate reporting for real and augmented images.

Rejected, unsupported, uncertain, wrong-side, partial-bottle, and poor-quality images should be preserved for diagnostics but excluded from trusted training labels by default.

## Model Requirements

The local model candidate must:

- Target the 1.5L bottle first.
- Predict remaining oil or the geometry needed to derive remaining oil.
- Run in the chosen mobile browser or Worker-compatible runtime within size, memory, cold-start, and latency budgets.
- Report confidence and quality diagnostics.
- Include model version, dataset version, training configuration, and metrics.
- Be evaluated against the same 55ml primary tolerance used by Stage 1.

## Hybrid Runtime Requirements

The first runtime promotion is hybrid, not local-only:

- Local inference runs first only after it passes accuracy and runtime gates.
- Gemini remains the first API fallback.
- Grok remains fallback after provider failure or configured low-confidence paths.
- Fallback triggers include low local confidence, poor image quality, wrong side, partial bottle, high local/API disagreement, runtime/model error, and unsupported or uncertain product identity.
- Records must preserve local estimate, API fallback estimate, chosen estimate, disagreement amount, fallback reason, and model/dataset versions.

## Exit Gate

Stage 2 is complete only when:

- A local-compatible model passes the agreed 55ml gate for valid 1.5L images or records a formal NO-GO with evidence.
- The hybrid runtime can explain when it trusts local inference and when it falls back.
- Admin review can prioritize low-confidence results, high-disagreement cases, and user corrections.
- Dataset export captures all provenance needed for the next training cycle.
