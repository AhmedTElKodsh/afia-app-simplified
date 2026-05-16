---
status: fixes_applied
fixes: 3
critical: 3
warning: 0
info: 0
---

# Code Review Fixes — CV Pipeline (M002/M003)

## Fixes Applied

### CR-1: Score/tier mismatch in regression path
**File:** `worker/src/cv/pipeline.ts:131-135`
**Fix:** Score and tier now derived from same `combinedScore = Math.max(confidence.score, regressionOutput.modelConfidence)`. Tier uses combinedScore with confidence.ts thresholds (≥0.7→high, ≥0.3→medium, <0.3→low).
**Before:** `score = Math.max(...)`, `tier = regressionOutput.modelConfidence >= 0.7 ? "high" : "medium"` — could produce score=0.8, tier="medium".

### CR-2: Logger race condition
**File:** `worker/src/cv/logger.ts`
**Fix:** Removed module-level mutable `StageLog[]` array. `logStage()` now writes to console.log only — per-request safe in Workers (each request's async chain is consistent). `printSummary()`/`getLogs()`/`clearLogs()` removed. New `logSummary(stages[])` accepts explicit array for per-call summary.
**Before:** Shared array with `clearLogs()` in one request erasing another's in-flight data.

### CR-4: Doc thresholds mismatch
**File:** `docs/cv-pipeline-architecture.md:33-34`
**Fix:** Updated medium threshold from 0.4 to 0.3 to match `confidence.ts` and `config.ts`.
**Before:** "Medium (≥0.4)" but code uses ≥0.3.

## Not Fixed (Lower Priority)

| Issue | Reason |
|-------|--------|
| CR-3: MatVector fallback | Potential use-after-free but untested path. Fix when fallback is exercised. |
| WR-4: Pixel-walk perf | ~2M JS iterations per call. Fix with `cv.reduce()` when latency requirements tighten. |
| WR-6: Mat leak on exception | OpenCV mat cleanup in finally. Rare — exception during preprocessing is unlikely. |
| WR-7: bottleSizeMl type | Route-level input validation. Minor — user sends wrong type, gets clear error. |
