---
phase: M002/M003
audit_type: general_best_practices
status: gaps_found
score:
  factual_accuracy: 4/5
  output_structure: 5/5
  task_completion: 3/5
  edge_coverage: 2/5
  regression_prevention: 4/5
  production_monitoring: 3/5
overall: 3.5/5
---

# Eval Review — CV Pipeline (M002 + M003)

**No AI-SPEC.md found.** Audit against general AI eval best practices per `ai-evals.md`.

---

## What Exists

### Eval Infrastructure
- **198-image stratified manifest** at `worker/test/fixtures/cv-eval/manifest.json` — 29 fill levels, weighted toward nonlinear shoulder/base regions
- **20-image edge-case manifest** at `worker/test/fixtures/cv-edge-eval/manifest.json` — curated failure modes (empty, dark, glare, no-contour, known-good)
- **Eval runner** at `worker/src/eval/cv-eval.ts` — manifest-based, reports exact/close accuracy, per-confidence-tier breakdown, per-fill-bucket breakdown, MAE per tier
- **JSONL result storage** at `runs/cv-eval-200/` — 20+ eval runs preserved for comparison
- **`pnpm eval:cv`** command for quick iteration
- **Comparison template** at `runs/cv-vs-gemini-comparison.md`

### What Gets Measured

| Metric | What | How |
|--------|------|-----|
| Exact accuracy (±55ml) | Overall pass rate | Code-based metric |
| Close accuracy (±110ml) | Tolerance pass rate | Code-based metric |
| Detection rate | % images where contour found | Code-based metric |
| Per confidence tier | Accuracy broken down by high/low | Code-based metric |
| Per fill bucket | Accuracy per fill level | Code-based metric |
| MAE per tier | Mean absolute error per confidence tier | Code-based metric |
| Worst misses | Top 5 largest errors | Code-based metric |

---

## Gaps by Evaluation Dimension

### 1. Factual Accuracy (3/5) ✅ Partial
**What exists:** Ground-truth labeled manifest with 198 images. Per-image error reporting. Comparison vs Gemini baseline.

**Gaps:**
- No confidence intervals — point estimates only (198 images, ~7/level is too few for statistical significance per Murat's review)
- No per-stratum MAE reporting (only aggregate and per-tier)
- No comparison against human labeler agreement (inter-rater reliability)

**Fix:** Add 95% confidence intervals to eval output. Compute MAE per fill bucket. Add inter-rater reliability target to manifest docs.

### 2. Output Structure Validity (5/5) ✅ Complete
JSON schema validation via `PipelineOutput` interface. All fields present. Response contract documented in `cv-pipeline-architecture.md`. Error types structured with stage/code/message/recoverable fields.

### 3. Task Completion (2/5) ❌ Partial
**Goal:** ±50ml accuracy. **Achieved:** 3.5-5.1% exact, 44.9-46.5% detection. The eval tells us the system does NOT achieve its goal — which is honest data — but the eval doesn't tell us WHY in enough detail to direct fixes.

**Gaps:**
- No per-stratum MAE — can't tell if specific fill levels are systematically worse
- No error analysis by image characteristic (brightness, contrast, label occlusion)
- No confusion matrix (what does the model predict when it's wrong? Cluster analysis?)
- No detection of "silent failures" — images where contour is found but prediction is wildly wrong (e.g., empty → 1400ml)

**Fix:** Add confusion band analysis (currently present in LLM eval runner `run.ts` but NOT in CV eval runner). Add MAE per fill bucket. Categorize failures (no-contour vs wrong-contour vs wild-prediction).

### 4. Edge Coverage (2/5) ❌ Partial
**What exists:** Manual edge-case manifest with 20 challenging images (empty, dark, glare, no-contour). Known-good cases included for contrast.

**Gaps:**
- No adversarial examples (motion blur, partial occlusion, extreme angles, condensation, reflection)
- No synthetic distortions (brightness sweeps, rotation sweeps, contrast sweeps)
- No non-bottle inputs (what happens when you send a photo of a car? A person?)
- Edge-case manifest too small (20 images) for statistical significance
- No performance/stress testing (latency under load, concurrent requests, cold start timing)

**Fix:** Build synthetic distortion sweeps using sharp/jpeg-js (brightness -50% to +50%, rotation -15° to +15°). Add non-bottle inputs to edge-case manifest. Add latency measurement to eval runner.

### 5. Regression Prevention (1/5) ❌ Missing
**Critical gap.** No automated regression gate exists. Changes are evaluated manually by comparing outputs of sequential `pnpm eval:cv` runs. There is:
- No CI/CD gate that blocks if accuracy drops >2%
- No statistical test (McNemar's or paired t-test) comparing runs
- No versioned eval baseline with automatic comparison
- No performance regression check (latency budget)

**Fix:** Add regression comparison mode to `cv-eval.ts` that reads a previous run's results and reports deltas with statistical significance. Add to CI pipeline as blocking gate.

### 6. Production Monitoring (2/5) ❌ Partial
**What exists:** Structured JSON logging per pipeline stage. Logs include stage name, latency, confidence, decision, error.

**Gaps:**
- No runtime accuracy monitoring — impossible to know if production predictions are correct without ground truth
- No confidence calibration check — are high-confidence predictions actually more accurate? (Eval says yes: 8.5% high vs 0% low)
- No drift detection — if image distribution shifts over time, no alert fires
- No user feedback loop — no mechanism to collect corrected measurements and retrain

**Fix:** Add ground-truth collection path (admin correction → labeled dataset). Add confidence calibration dashboard. Add drift detection on confidence distribution.

---

## Score Summary

| Dimension | Score | Priority |
|-----------|:-----:|:--------:|
| Factual accuracy | 3/5 | Medium |
| Output structure validity | 5/5 | Low |
| Task completion | 2/5 | High |
| Edge coverage | 2/5 | High |
| Regression prevention | 1/5 | **Critical** |
| Production monitoring | 2/5 | Medium |
| **Overall** | **2.5/5** | |

## Priority Remediation Plan

| Priority | Fix | Effort | Current Status |
|----------|-----|--------|----------------|
| P0 | Add regression comparison gate to eval runner | 1h | ✅ Done — `BASELINE_RUN` env var, exits 1 on regression >2pp |
| P1 | Add per-stratum MAE + confusion bands | 1h | ✅ Done — confusion bands and per-bucket MAE added |
| P1 | Add synthetic distortion sweeps to edge manifest | 2h | ❌ Not started — requires build script |
| P2 | Add 95% confidence intervals to eval output | 0.5h | ✅ Done — Wilson score interval |
| P2 | Add latency measurement to eval runner | 0.5h | ✅ Done — avg/p50/p95/p99 reported |
