# Fusion Decision Record

## Applied to: Phase 02 Plan 03 — Heuristic Improvements
## Date: 2026-05-16

### Context
Multi-contour fusion (D-17 stage C) was evaluated because Tasks 1+2
(pre-processing + contour tuning) did not meet ACCR-02 target:
≤3 empty↔full flips on 30 edge-case images (achieved 4).

### Fusion Approach
Top-3 scored contours each independently detect meniscus position.
Weighted average of meniscus Y positions (weighted by contour score).

### Results Summary

| Metric | No Fusion | Fusion | Delta |
|--------|-----------|--------|-------|
| Exact accuracy | 13.3% | 20.0% | +6.7pp |
| Close accuracy | 16.7% | 23.3% | +6.6pp |
| Contour found | 96.7% | 96.7% | 0pp |
| Empty↔full flips | 4 | 6 | +2 |
| Latency avg | 103ms | 95ms | -8ms |

### Decision: REVERT — Fusion Disabled

**Rationale:** While fusion improved overall exact accuracy by 6.7pp,
it increased the primary ACCR-02 target metric (empty↔full confusion)
from 4 to 6 flips. The project's primary requirement is minimizing
confusion errors, not maximizing overall accuracy.

**Root cause of fusion regression:** Different contour bounding boxes
have different Y reference frames for meniscus position. Weighted
averaging of meniscusY across differently-sized bounding boxes
introduces alignment errors, particularly for full-bottle images
where contour boundaries are less reliable.

### Future Options
- Mask-weighted fusion (align contours to common reference frame)
- Only fuse meniscus ratios (not absolute Y positions)
- Use fusion only for low-confidence predictions
- These are deferred — not needed for v1.0
