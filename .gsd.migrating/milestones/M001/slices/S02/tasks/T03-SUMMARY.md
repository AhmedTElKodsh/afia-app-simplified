---
id: T03
parent: S02
milestone: M001
key_files:
  - (none)
key_decisions:
  - (none)
duration: 
verification_result: passed
completed_at: 2026-05-13T16:39:55.415Z
blocker_discovered: false
---

# T03: Refined system and bottle-reference prompts to emphasize visual detection and prevent few-shot anchoring.

**Refined system and bottle-reference prompts to emphasize visual detection and prevent few-shot anchoring.**

## What Happened

Refined `system.md` and `bottle-reference.md` to emphasize visual feature detection and penalize few-shot pattern matching. 

Key improvements:
- Added explicit instructions to look for the "meniscus signature" (curves, translucent changes, light/dark edges).
- Added a "CRITICAL" warning in `system.md` to favor observation over recall.
- Added an "Anti-Pattern Warning" section in `bottle-reference.md` specifically targeting "Few-Shot Ghosting" and "Label Snapping".
- Strengthened the instruction to interpolate and avoid repeating few-shot values exactly, emphasizing that every target image is unique.
- Clarified that the physical meniscus is the ONLY ground truth, not the label artwork or packaging colors.

## Verification

Manually reviewed the updated `system.md` and `bottle-reference.md` for clarity, strength of instructions, and alignment with the goal of reducing few-shot anchoring.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cat worker/src/prompt/v1/system.md` | 0 | ✅ pass | 50ms |
| 2 | `cat worker/src/prompt/v1/bottle-reference.md` | 0 | ✅ pass | 50ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

None.
