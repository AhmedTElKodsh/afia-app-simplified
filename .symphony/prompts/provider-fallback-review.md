# Provider Fallback Review Prompt

Review Gemini/Grok provider changes for Afia Stage 1.

Expected behavior:

- Gemini is attempted first.
- Multiple Gemini keys are rotated when configured.
- A failed Gemini attempt is retried once after a short delay when appropriate.
- Grok fallback runs when Gemini is unavailable, exhausted, or returns unusable/low-confidence output.
- The final normalized result includes provider, confidence, warnings, model version, prompt version, raw metadata, and fallback reason when applicable.
- Provider-specific details do not leak into Web-facing contracts except through explicit normalized metadata.

Check separately:

- Auth/key failure.
- Quota/rate-limit failure.
- Network failure.
- Model refusal or malformed text.
- Invalid JSON.
- Valid JSON with schema failure.
- Low confidence.

Require tests or deterministic fakes for each changed branch.
