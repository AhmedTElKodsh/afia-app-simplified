---
id: T03
parent: S04
milestone: M001
key_files:
  - runs/*.jsonl
key_decisions:
  - CoT + Golden Set (5 shots) did NOT improve accuracy
  - Model still anchors to high values (~1400ml) ignoring visual input
duration:
verification_result: failed
completed_at: 2026-05-13T21:30:00.000Z
blocker_discovered: false
---

# T03: Run probe eval (v3)

**Ran probe eval with Golden Set (5 shots) + CoT (thinkingBudget=1024). Results: WORSE than baseline.**

## What Happened

Ran 10/12 probe images before API overloaded (503). The CoT + Golden Set combination did NOT improve accuracy:

- MAE ≈ 442ml (vs 390ml S01 baseline, 427ml S02)
- Exact accuracy: 20% (2/10)
- Close accuracy (±110ml): 30% (3/10)

The model appears to ignore the CoT instruction and default to ~1400ml predictions for most images. The thinking budget doesn't seem to help — the model still doesn't attend to the target image.

Notable failures:
- 275ml predicted as 923ml (+648ml error)
- 0ml (empty) predicted as 1481ml (+1481ml error)
- 825ml predicted as 173ml (-652ml error)

## Verification

Compared MAE with v1/v2:
- S01 baseline: MAE 390ml
- S02 (few-shot expansion): MAE 427ml
- S03 (CoT + Golden Set): MAE ~442ml ← WORSE

**Verdict: Strategy failed. CoT did not improve accuracy.**

## Deviations

None.

## Known Issues

- CoT instruction in system.md is present but model ignores it
- Thinking budget (1024 tokens) doesn't ensure visual attention
- Golden Set (5 shots) still allows anchoring bias

## Files Created/Modified

- runs/2026-05-13T21-*.jsonl (partial results)
