---
id: S02
parent: M001
milestone: M001
provides:
  - (none)
requires:
  []
affects:
  []
key_files:
  - (none)
key_decisions:
  - (none)
patterns_established:
  - (none)
observability_surfaces:
  - none
drill_down_paths:
  []
duration: ""
verification_result: passed
completed_at: 2026-05-13T18:49:02.652Z
blocker_discovered: false
---

# S02: Few-Shot Expansion & Prompt Refinement

**Completed Slice S02 with a negative result; expanded few-shots and refined prompts did not improve accuracy, indicating a need for a different strategy.**

## What Happened

Slice S02 attempted to boost accuracy through few-shot expansion (7 to 12 anchors) and prompt refinement emphasizing physical visual signatures (meniscus curve, translucency). 

The results were negative: Mean Absolute Error (MAE) increased from 390ml to 427ml. 
The model (`gemini-2.5-flash`) continues to exhibit "Few-Shot Ghosting" and "Label Snapping," defaulting to the 400-700ml range (the label area) for almost all inputs.

Key Findings:
1. **Saturation:** 12 few-shots might be too many for the model's visual reasoning window, causing it to "lose" the target image or over-aggregate reference data.
2. **Persistence of Anchoring:** Even with explicit anti-pattern warnings, the model prefers pattern matching over direct observation.
3. **Linear Model Validation:** The mathematical model for mapping ratios to ML is now solid and verified, even if the model isn't using it accurately yet.

Next steps should involve reducing few-shot count to a "Golden Set" of 5-6 highly distinct images and potentially experimenting with higher-reasoning models (Pro) or enabling thinking budgets if available.

## Verification

Verified execution of all tasks. Metrics comparison performed.

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

None.

## Known Limitations

None.

## Follow-ups

None.

## Files Created/Modified

None.
