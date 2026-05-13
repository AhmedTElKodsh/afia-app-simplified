---
id: T01
parent: S02
milestone: M001
key_files:
  - (none)
key_decisions:
  - (none)
duration: 
verification_result: untested
completed_at: 2026-05-13T13:40:41.181Z
blocker_discovered: false
---

# T01: Analyzed probe failures and confirmed few-shot anchoring issues.

**Analyzed probe failures and confirmed few-shot anchoring issues.**

## What Happened

Analyzed the probe run records. Confirmed that the model is heavily anchoring to few-shot values (e.g., 0.46, 0.52, 0.57, 0.62) and failing to correctly identify oil levels even at the extreme ends (predicting 962ml for a 1485ml bottle). The model returns high confidence (0.9) despite these massive errors, indicating it is not correctly observing the visual features but rather matching patterns or guessing from the provided anchors. The use of 'gemini-2.5-flash' (likely a typo or experimental version) might also be a factor.

## Verification

None. Analysis based on runs/*.jsonl output.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| — | No verification commands discovered | — | — | — |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

None.
