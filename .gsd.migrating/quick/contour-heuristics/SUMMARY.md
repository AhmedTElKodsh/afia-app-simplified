# Quick Task: Fix Contour Detection — Heuristic Scoring

**Goal:** Replace "largest contour = bottle body" with aspect ratio + position + size scoring.
**Result:** Contour detection rate improved 33% → 46%. Accuracy doubled 2.0% → 4.5%.

## Changes

**`worker/src/cv/contour.ts`:**
- Replaced single-criterion `maxArea` with multi-factor heuristic scoring
- Aspect ratio (0.5 weight): bottle should be tall (height > 2x width)
- Centered position (0.3 weight): bottle in middle of frame
- Reasonable size (0.2 weight): bottle occupies meaningful portion of frame
- Minimum score threshold (0.3) rejects non-bottle contours
- Added `bestScore < 0.3` guard: returns not-found instead of picking bad contour

## Results (198-image eval)

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Contour found | 66 (33%) | 92 (46%) | +39% |
| Exact (±55ml) | 4 (2.0%) | 9 (4.5%) | +125% |
| Close (±110ml) | 6 (3.0%) | 19 (9.6%) | +217% |
| High-conf accuracy | 6.1% | 9.8% | +61% |
