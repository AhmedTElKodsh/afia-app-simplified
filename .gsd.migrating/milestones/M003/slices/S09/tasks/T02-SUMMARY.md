---
id: T02
parent: S09
milestone: M003
key_files:
  - runs/calibration-*.json
key_decisions:
  - very_low(0-165ml) bucket = best accuracy at 11.1%
  - empty bottles = 0% accuracy — no meniscus to detect
completed_at: 2026-05-13
verification_result: passed
---

# T02: Run calibration eval

Ran full eval + edge-case eval with new confidence scoring. Confirmed tiers discriminate. Documented per-stratum results.

## Results

| Bucket | Exact | Close | Samples |
|--------|-------|-------|---------|
| empty | 0% | 0% | 9 |
| very_low(0-165) | 11.1% | 18.5% | 27 |
| low(165-330) | 7.4% | 11.1% | 27 |
| mid_low(330-660) | — | — | 0 |
| mid_high(660-990) | — | — | 0 |
| high(990-1320) | 2.2% | 8.9% | 45 |
| very_high(1320-1500) | 5.6% | 5.6% | 36 |
