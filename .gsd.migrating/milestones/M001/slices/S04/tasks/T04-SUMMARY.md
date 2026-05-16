---
id: T04
parent: S04
milestone: M001
key_files:
  - runs/2026-05-13T21-*.jsonl
key_decisions:
  - CoT + Golden Set strategy FAILED — worse than baseline
  - Recommendation: DO NOT proceed to S03 (Full Dev Validation) with this strategy
  - Next step: Move to a different approach (local model, Stage 2, or different prompt strategy)
duration:
verification_result: failed
completed_at: 2026-05-13T21:45:00.000Z
blocker_discovered: true
---

# T04: Strategy evaluation and selection

**CoT + Golden Set strategy FAILED. Recommendation: abort this approach and pivot.**

## What Happened

Analyzed v3 probe eval results (10/12 images before 503 error):

| Metric | S01 Baseline | S02 (12 shots) | S03 (CoT + Golden Set) |
|---------|---------------|-----------------|--------------------------|
| MAE | 390ml | 427ml | ~442ml |
| Exact (±55ml) | 0% | 0% | 20% (2/10) |
| Close (±110ml) | 8.3% | ? | 30% (3/10) |

**Verdict: FAILED.** The strategy made accuracy WORSE. The model ignored the CoT instruction and continued anchoring to ~1400ml predictions.

## Verification

Must-haves from S04-PLAN.md:
- MAE < 300ml on probe set: ❌ 442ml (FAIL)
- No 'Few-Shot Ghosting': ❌ Model still defaulting to ~1400ml (FAIL)

## Decision

**NO-GO for S03 (Full Dev Validation).** This strategy should NOT be deployed to production or used for full dev set evaluation.

**Root cause**: The model (gemini-2.5-flash) fundamentally cannot overcome anchoring bias with prompt-level CoT alone. It needs either:
1. A local vision model (Stage 2)
2. Heavily augmented training data (not feasible in Stage 1)
3. A different LLM (GPT-4V, Claude 3.5 Sonnet) — but cost/quota limited

## Blocker Discovered

**Blocker**: CoT + Golden Set strategy failed to improve accuracy.
**Impact**: S03 (Full Dev Validation) is blocked — there's no viable strategy to validate.
**Resolution**: Pivot to Stage 2 (local model) or try a fundamentally different approach.

## Files Created/Modified

- .gsd/milestones/M001/slices/S04/tasks/T04-SUMMARY.md (this file)
