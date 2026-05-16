# S04: Remediation: Golden Set & CoT Strategy

**Goal:** Drastically reduce anchoring bias by using a smaller, high-quality 'Golden Set' of shots and introducing explicit visual reasoning (CoT).
**Demo:** Reduced error on probe set with more reliable confidence.

## Must-Haves

- MAE < 300ml on probe set. No 'Few-Shot Ghosting' observed in top 5 failures.

## Proof Level

- This slice proves: probe eval v3 metrics

## Integration Closure

Resulting configuration is used for full dev validation.

## Verification

- CoT provides insights into WHY the model missed.

## Tasks

- [x] **T01: Select Golden Set of few-shot anchors** `est:15m`
  Reduce few-shot count from 12 to 5-6 highly distinct anchors (Empty, 330, 770, 1100, Full). Ensure images are high contrast and meniscus is clearly visible.
  - Files: `worker/src/prompt/v1/few-shots/*.json`
  - Verify: Check few-shot directory count.

- [x] **T02: Implement visual reasoning (CoT) logic** `est:30m`
  Modify prompts to allow/require a brief visual reasoning block before the final JSON. Update `system.md` and `gemini.ts` if needed to handle thinking budget or multi-part output.
  - Files: `worker/src/prompt/v1/system.md`, `worker/src/llm/gemini.ts`
  - Verify: Manual test call showing reasoning.

- [x] **T03: Run probe eval (v3)** `est:15m`
  Run the probe eval again with the Golden Set and CoT.
  - Files: `runs/*.jsonl`
  - Verify: Compare MAE with v1/v2.

- [x] **T04: Strategy evaluation and selection** `est:15m`
  Final analysis of v3 results. Decide if this strategy is ready for full dev validation.
  - Verify: Narrative report.

## Files Likely Touched

- worker/src/prompt/v1/few-shots/*.json
- worker/src/prompt/v1/system.md
- worker/src/llm/gemini.ts
- runs/*.jsonl
