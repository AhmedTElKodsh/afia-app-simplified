---
reviewers: [winston, amelia, mary, murat]
reviewed_at: 2026-05-13
plans_reviewed:
  - M002-ROADMAP.md (4 slices)
  - M002-REQUIREMENTS.md (32 requirements)
  - Post-milestone tuning experiments (adaptive CLAHE, adaptive threshold, template matching)
---

# Cross-AI Milestone Review — M002: Stage 2: Computer Vision Pipeline

## 🏗️ Winston Review

### Summary
Infrastructure complete, accuracy fail. The pipeline chassis works but the engine doesn't. 46% detection, 4.5% exact — 54% of users get nothing.

### Key Findings
- **Confidence scoring is a tautology** — every successful detection scores ≥0.7 (edgeClarity + meniscusBounds + bottleRegion always sum to ≥0.8). Regression and LLM tiers never fire. Dead code.
- **Canny(50,150) is too narrow** — one threshold pair for all lighting conditions. Otsu-based Canny would adapt per image.
- **Mock regression has no training signal** — just another heuristic.

### Recommendations
1. Replace `Canny(50,150)` with Otsu-thresholded Canny (~10 lines, highest leverage)
2. Fix confidence scoring — remove automatic free points, calibrate against eval data
3. Next milestone should be "Pipeline Hardening" not "Regression Training"

---

## 💻 Amelia Review

### Critical Bug Found
**`contour.ts:28-42`** — Triple duplicate Canny/findContours block with use-after-free on `edges` mat after `edges.delete()` on line 32. Lines 33-42 operate on freed WASM heap memory, producing non-deterministic results. This may be degrading accuracy.

### Other Code Issues
- `sharp` is a native Node.js addon — **cannot run on Cloudflare Workers**. Architectural blocker.
- `findHorizontalEdges` allocates `gradX` but never uses it
- `confidence.ts:19` — `edgeStrength / 1000` denominator is arbitrary, not grounded
- No per-stratum eval metrics (can't tell where the model works vs fails)

### Recommendations
1. **Fix the Canny triple-duplicate bug first** — then re-eval to get true baseline
2. Replace `sharp` with `@napi-rs/image` or pure-WASM decoder for Worker compatibility
3. Add per-stratum metrics to eval runner

---

## 📊 Mary Review

### Value Assessment
32 requirements implemented, zero deliver the core ±50ml ask. Beautiful infrastructure, but the user outcome is 4.5% exact, 54% detection failure. Built a refinery before finding oil.

### Minimum Viable Bar
- **Detection rate ≥ 80%** (currently 46%)
- **Of detected: ≥ 70% within ±110ml** (currently 9.6%)
- Below these bars: product erodes trust without delivering value

### Recommendations
1. **Add guided capture UX** — controlling input quality is higher ROI than any CV tuning
2. **Kill regression model dependency for now** — it can't help until contours are found
3. **Accept ±110ml as v1 target**, not ±50ml
4. **Consider categorical levels** (Quarter/Half/Three Quarters/Full) if ±110ml unachievable

---

## 🧪 Murat Review

### Risk Profile: CRITICAL
- 54% contour-not-found is a product-killer — one in two users gets nothing
- 4.5% correct at ±55ml = correct 1 in 22 attempts
- LLM validation is dead code (empty API key)
- No integration tests, no edge-case matrix, no performance benchmarks

### Test Strategy Gaps
| Gap | Severity |
|-----|----------|
| No integration tests for Worker endpoint | Critical |
| No edge-case image matrix (blur, glare, occlusion, tilt, reflection) | Critical |
| No confidence calibration suite | High |
| No regression gate between iterations | High |
| 198 images at ~7/level — need ~30/level minimum | Medium |

### Recommendations
1. Fix LLM validation path (5-minute fix, carried for weeks)
2. Clamp confidence to [0, 1.0]
3. Build edge-case image matrix before next CV iteration
4. Treat 4.5% as capability ceiling signal, not baseline to beat
5. **Minimum: 870 images** (30 per fill level) for statistical significance

---

## Consensus Summary

### Agreed Strengths
- Pipeline architecture (validate → preprocess → contour → confidence → gate) is sound
- Heuristic scoring improved detection 33%→46%
- Eval runner and 198-image set are valuable infrastructure
- OpenCV.js WASM on Workers is viable

### Agreed Concerns (All 4 Agents)
1. **54% contour miss rate is the #1 blocker** — no path to ±50ml without fixing this
2. **LLM validation is dead code** — empty API key makes the entire fallback branch a no-op
3. **Confidence scoring is uncalibrated** — every detection scores "high", regression/LLM tiers never fire
4. **Template matching is permanently dead** — all 4 agree, don't revisit
5. **Adaptive approaches (CLAHE, threshold) correctly rejected** — don't revisit (3 of 4 agree)

### Divergent Views
- **Next step priority:** Winston says Otsu Canny fix. Amelia says fix triple-duplicate bug first. Mary says guided capture UX. Murat says edge-case image matrix.
- **±50ml target:** Mary says lower to ±110ml. Winston says ±50ml still achievable with Otsu Canny + calibration. Murat says need 870-image eval to know.
- **Regression model:** Winston and Mary say defer until contour fixed. Amelia says it's highest leverage path.

### Recommended Actions (Priority Order)
1. **P0: Fix `contour.ts:28-42` triple-duplicate Canny bug** (Amelia) — could be degrading accuracy, artifacts-first
2. **P0: Fix LLM validation empty API key** (Murat, Winston, Amelia) — 5-minute fix carried for weeks
3. **P0: Fix confidence scoring in `confidence.ts`** — clamp to [0,1.0], remove automatic "high" from every detection
4. **P1: Replace fixed Canny(50,150) with Otsu-thresholded Canny** (Winston) — highest leverage CV improvement
5. **P1: Add per-stratum eval metrics** (Amelia, Murat) — necessary to target improvements
6. **P1: Build edge-case image matrix** (Murat) — without it, tuning is blind
7. **P2: Replace `sharp` with WASM-compatible decoder** (Amelia) — required for Worker deployment
8. **P2: Guided capture UX** (Mary) — highest ROI non-CV improvement
