---
id: T02
parent: S10
milestone: M003
key_files:
  - runs/edge-eval-*.json
key_decisions:
  - Edge-case detection rate: 40% (8/20) — unchanged from baseline
  - Edge-case exact accuracy: 0% (0/20) — unchanged
  - No regression on main eval set (46.5% detection, 5.1% exact — unchanged)
completed_at: 2026-05-13
verification_result: passed
---

# T02: Run edge-case eval

Ran edge-case eval with adaptive threshold fallback. No change in detection rate or accuracy. The edge-case images genuinely lack detectable bottle contours.

## Results

| Metric | Main Eval | Edge-case Eval |
|--------|-----------|----------------|
| Detection rate | 46.5% | 40.0% |
| Exact accuracy | 5.1% | 0.0% |
| Contour found | 92/198 | 8/20 |
