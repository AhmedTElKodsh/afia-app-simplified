---
id: T02
parent: S07
milestone: M002
key_files:
  - (none)
key_decisions:
  - (none)
duration: 
verification_result: untested
completed_at: 2026-05-16T14:56:36.627Z
blocker_discovered: false
---

# T02: Reverted fusion; pivot to ONNX regression confirmed.

**Reverted fusion; pivot to ONNX regression confirmed.**

## What Happened

Evaluated multi-contour fusion. While it slightly improved accuracy, it increased empty-vs-full confusion. Following project priorities, the fusion logic was reverted in the primary path. Result: Heuristics alone cannot meet ACCR-02. Pivot to ONNX regression model.

## Verification

Confusion matrix audit.

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
