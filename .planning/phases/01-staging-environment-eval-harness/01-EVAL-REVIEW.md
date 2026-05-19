---
phase: 01-staging-environment-eval-harness
reviewed: 2026-05-16
score: 68
verdict: NEEDS WORK
ai_capability_deployed: true
state: B (no AI-SPEC.md)
---

# Phase 1 Eval Coverage Audit

## Overall Score: 68/100

## Verdict: NEEDS WORK

All critical dimensions are at least PARTIAL, but 4 critical gaps prevent PRODUCTION READY status.

## Critical Gap Count: 4

---

## Dimension-by-Dimension Scoring

### 1. Code-Based Metrics — COVERED (95/100)

**What exists:**
- Deterministic `compareMl` (`worker/src/eval/compare.ts:6`) with two tolerance bands: exact (EXACT_TOLERANCE_ML) and close (CLOSE_TOLERANCE_ML). Both exported from `@afia/shared`, versioned with comparator name/version metadata recorded per run record.
- Per-stratum, per-source, and per-fill-bucket accuracy breakdowns printed on every run. Each stratum's exact/close pass rate is computed separately — not just a single aggregate number.
- Confusion bands (low→low, low→mid, ..., high→high) computed and printed, revealing systematic prediction biases by fill-level band.
- Worst-5 misses by absolute error logged with imageId, ground truth, prediction, error, confidence, stratum, probe note, and raw output excerpt — enabling targeted failure analysis.
- Signoff gate (`worker/src/eval/signoff.ts`) uses three gating metrics with explicit bars: aggregate ≥90% exact pass, per-stratum ≥80% exact pass, and byte-stability ≥38/40 fixtures across 3 holdout runs.
- High-confidence miss detection: flags cases where confidence ≥0.80 but exact bucket fails — surfacing the most dangerous failure mode (model is certain and wrong).
- Rate limiting (60s between fixtures) and key rotation accounted for in eval script.

**Evidence:** `worker/src/eval/run.ts:56-173`, `worker/src/eval/signoff.ts:12-15`, `worker/src/eval/compare.ts:6-13`

---

### 2. LLM Judges — MISSING (0/100)

**What exists:** Nothing.

**What's missing:**
- No LLM-as-judge evaluates output quality beyond numerical accuracy. There is no assessment of output coherence, formatting quality, reasoning soundness, or adherence to instructions.
- No pairwise comparison between model versions (e.g., "does Gemini 2.0 output look better than the previous model?").
- No open-ended response quality scoring (e.g., 1-5 Likert across relevance, completeness, fluency).

**Mitigating context:**
- The primary capability (remaining-ml estimation) is well-captured by code-based metrics against ground truth.
- A judge LLM would add the most value once the system supports more open-ended outputs (e.g., Phase 2+ evidence responses).

**Evidence:** No `*judge*`, `*grader*`, or LLM-as-judge pattern exists in any eval file.

---

### 3. Human Evaluation — PARTIAL (50/100)

**What exists:**
- Signoff gate (`worker/src/eval/signoff.ts:72-96`) requires an interactive human reviewer: name, binary yes/no decision, and free-text notes. Each signoff is recorded to `signoffs.jsonl` with full run metadata.
- Signoff decisions are append-only JSONL, providing an audit trail over time.
- The human reviews the latest holdout JSONL before signing — raw outputs, predictions, and errors are visible.

**What's missing:**
- No structured scoring rubric (e.g., "rate each output on a 1-5 scale for accuracy, completeness, readability"). The human can only say "yes" or "no."
- No inter-rater reliability measurement — a single reviewer signs off with no diversity requirement.
- No annotation guidelines document defining what "trustworthy enough" means.
- No mechanism for ongoing human eval between signoff events — ad-hoc human review only happens at release gates.
- No blind/A-B setup — the reviewer sees the metrics before deciding, which risks confirmation bias.

**Evidence:** `worker/src/eval/signoff.ts:72-96`

---

### 4. Pre-Deployment Dimensions — COVERED (85/100)

| Sub-dimension | Status | Evidence |
|---|---|---|
| **Factual accuracy** | COVERED | GroundTruthMl comparison, aggregate + stratum thresholds, signoff gate at ≥90%/≥80% |
| **Output structure validity** | COVERED | Zod schema validation in `parse-response.ts:4-9` with `Schema.parse()`; code-block extraction + JSON fallback; clamped outputs within [0,1500] and [0,1] |
| **Task completion** | COVERED | Runner tracks `parsedMl === null` as failed parse; error records have `absErrorMl: null`; failing fixtures are counted separately from successful ones |
| **Tool use correctness** | N/A | System does not use function calling or tools at this stage |

**What's missing:**
- No latency SLO check (e.g., "99th percentile response must be <10s") as a pre-deployment gate.
- No cost budget gate (e.g., "mean tokens per inference must not exceed X").
- No regression comparison against the previous eval run's metrics — the signoff gate evaluates absolute thresholds, not relative degradation.

**Evidence:** `worker/src/eval/parse-response.ts:21-30`, `worker/src/eval/run.ts:62-78`

---

### 5. Production Monitoring — PARTIAL (35/100)

**What exists:**
- Nightly eval run via `cron: "0 6 * * *"` (`ci.yaml:21`) for drift detection — runs full dev + holdout + edge evals every 06:00 UTC.
- Artifact persistence via `actions/upload-artifact@v4` on full-eval, edge-eval, and nightly-eval jobs — results are not lost when the runner finishes.
- Signoff gate provides a pre-release quality check.
- Eval results contain prompt hash, few-shot hash, model version, and comparator version for reproducibility.

**What's missing:**
- **No cost telemetry.** Token counts, inference cost, and API call counts are not recorded in run records. There is no $/eval or $/inference metric.
- **No latency telemetry.** Per-fixture response time, 50th/95th/99th percentile latency, and total run duration are not collected. Cost/latency drift is invisible.
- **No automated baseline comparison.** Nightly runs produce artifacts but don't compare to the previous run's metrics. A human must manually diff two JSONL artifact sets to detect degradation.
- **No alerting.** If nightly eval accuracy drops below a threshold, no notification fires (no Slack, email, or issue creation).
- **No dashboard or reporting.** Results live in JSONL files in CI artifacts. There is no pivot table, chart, or trend line. The user must download and analyze artifacts manually.
- **No guardrail for cost explosion.** If a model change doubles token usage, nothing stops it.

**Evidence:** `ci.yaml:186-213` (nightly-eval artifact upload exists, but no comparison/alerting step)

---

### 6. Eval Infrastructure & Robustness — COVERED (90/100)

**What exists:**
- **Stratified fixture set:** Fill buckets (empty-low, high, mid-high, mid-low); sources (augmented, real); failure modes (glare, dark, contour, all bottle sizes). Coverage is deliberate, not accidental.
- **Dev/holdout split:** 60 dev + 40 holdout fixtures. Holdout has a sealed counter (`holdoutTouches`) that auto-increments on each run, providing a tamper-evident seal.
- **Dedicated edge-case corpus:** 20 CV images across 5 failure modes with labelled ground-truth, reason, and stratum per fixture.
- **CI integration:** Path-filtered quick eval on push (12 fixtures, ~8 min full workflow). Full eval on merge (100 fixtures). Nightly eval (100 fixtures + 20 CV). Manual signoff dispatch.
- **Rate limiting:** 60-second delay between API calls (`run.ts:98-99`) with documented reasoning about key rotation.
- **Reproducibility:** Run records capture promptHash, fewshotHash, modelId, modelVersion, comparatorName, comparatorVersion, runId, and timestamp.
- **Artifact persistence:** JSONL files uploaded on every eval job, organized by run ID and timestamp.

**What's missing:**
- No test-time augmentation for robustness measurement (e.g., running same fixture with different crops/rotations).
- No statistical significance testing (e.g., "is the 2% accuracy drop real or noise?" — need confidence intervals or bootstrap).
- No cross-validation split — the dev/holdout split is fixed; no k-fold or leave-one-out evaluation.

**Evidence:** `ci.yaml:77-93` (path filtering), `worker/src/eval/run.ts:40-46` (holdout seal), `01-01-SUMMARY.md:73-84` (stratification documentation)

---

## Gap Analysis & Remediation

### Critical Gaps (must fix for Phase 2 readiness)

| # | Gap | Impact | Remediation |
|---|---|---|---|
| G1 | **No cost/latency/token telemetry** in eval records | Blind to cost drift; cannot budget inference spend; regressions in response time invisible | Add `startTime`, `endTime`, `tokenCount`, `costEstimate` fields to `RunRecord`. Collect per-fixture in `run.ts:62-78` and summarize in CI output. |
| G2 | **No automated baseline comparison across eval runs** | Nightly drift detection produces unactionable artifacts; degradation only found by manual diff | Add a `compare-runs.ts` script that takes two JSONL paths and prints Δ in aggregate accuracy, per-stratum accuracy, mean cost, mean latency. Wire it into nightly-eval as a post-eval step that diffs against the previous run's artifact. |
| G3 | **No LLM judge for output quality** | Cannot assess answer quality beyond numerical accuracy; blind to hallucination, formatting breakage, or instruction-following drift | Add a `judge` eval mode that sends a second LLM call asking for a 1-5 score on accuracy, completeness, and formatting. Run as a CI check on merge-to-main. |
| G4 | **No alerting on eval degradation** | Nightly drift detection has no notification path; accuracy drop goes unnoticed until the next human check | Add `ACTION_FAIL_THRESHOLD` env var to nightly-eval. If aggregate accuracy drops below threshold, fail the CI job and optionally create a GitHub issue via `peter-evans/create-issue-from-file@v5`. |

### Significant Gaps (should fix before production launch)

| # | Gap | Impact | Remediation |
|---|---|---|---|
| G5 | **No eval dashboard/reporting** | Results buried in CI artifacts; no trend visibility; stakeholders can't self-serve | Publish eval summaries as a CI job summary (`$GITHUB_STEP_SUMMARY` markdown table). Consider a simple static HTML report generated post-run. |
| G6 | **Human signoff is single-reviewer with no rubric** | Binary yes/no with no structured scoring; single point of human judgment; no inter-rater check | Add a structured rubric (3-5 criteria × 1-5 scale) to signoff.ts. Require at least one additional reviewer for production releases. Document annotation guidelines. |
| G7 | **No latency or cost pre-deployment gates** | Deploy passes even if the model is 3× slower or 2× more expensive | Add latency budget (e.g., p95 < 8s) and cost budget (e.g., mean tokens < 2000) as signoff-gate metrics alongside accuracy. |

### Minor Gaps (track but don't block)

| # | Gap | Impact | Remediation |
|---|---|---|---|
| G8 | No cross-validation or k-fold eval split | Fixed dev/holdout split may overfit; no confidence intervals | Add optional `--k-fold` flag to `run.ts` for periodic cross-validation runs on the dev set. |
| G9 | No test-time augmentation for robustness | Can't measure sensitivity to small input variations | Add optional `--augment` flag (crop, rotate, brightness) to estimate robustness variance. |
| G10 | No model version diff/changelog captured | When model changes, you have to infer what changed from commit messages | Capture `modelVersion` (already done) and add `modelChangelog` field by reading git log between tags. |

---

## Strengths

| # | Strength | Why it matters |
|---|---|---|
| S1 | **Stratified eval design with explicit strata** (fill buckets, sources, failure modes) | Avoids the common pitfall of a monolithic accuracy number that hides systematic failure on specific subpopulations. The confusion bands matrix is especially insightful. |
| S2 | **Sealed holdout set with tamper-evident counter** | Prevents the most common eval contamination: accidentally iterating on the holdout set. The auto-incrementing `holdoutTouches` field makes leakage detectable in CI. |
| S3 | **Three-tier eval system** (quick-on-push / full-on-merge / nightly-drift) | Matches the development workflow: fast feedback during dev, thorough validation before deploy, continuous monitoring after. Path filtering prevents wasted runs. |
| S4 | **Signoff gate with three independent metrics** (aggregate, per-stratum, byte-stability) | No single metric can be gamed. Aggregate catches broad degradation, per-stratum catches narrow regressions, byte-stability catches output format drift. Human override preserves escape hatch. |
| S5 | **Reproducibility metadata in every run record** (prompt hash, few-shot hash, model version, comparator version) | Enables exact reproduction of any eval run months later. Essential for debugging production incidents where "the model was different before." |
| S6 | **Edge-case corpus with labelled failure modes** | 20 curated images across 5 failure modes with ground-truth + reason per fixture. Surface-level metrics hide edge-case failures; this corpus surfaces them proactively. |
| S7 | **Output schema validation** (Zod parsing in `parse-response.ts`) | Prevents silent acceptance of malformed LLM output. The eval correctly treats parse failures as errors rather than silently accepting null/padded values. |
| S8 | **High-confidence miss detection** in eval output | Surfaces the most dangerous pattern: the model is confident and wrong. Without this, you'd miss failures that are both critical and silent. |

---

## Next Steps

Based on the NEEDS WORK verdict, the following actions are recommended before Phase 2 execution begins:

### Immediate (before Phase 2)

1. **Fix G1 — Add cost/latency telemetry.** This is a small change to `run.ts` (add `startTime`, `endTime`, token count collection) and the `RunRecord` type. Without it, Phase 2 will make cost-blind decisions.

2. **Fix G2 — Add baseline comparison.** Write a `compare-runs.ts` script (~50 lines) and wire it into nightly-eval. This turns artifact persistence from passive storage into active drift detection.

3. **Fix G4 — Add alerting threshold.** Add a `DEGRADATION_THRESHOLD` env var to the nightly-eval job. Start with a simple CI job failure; add GitHub issue creation in Phase 2.

### This Phase, If Slipped

4. **Fix G3 — LLM judge (minimal version).** Add a `--judge` flag to `run.ts` that sends a judge LLM call for each fixture output on a 1-3 scale. Run only on merge-to-main. Even a simple judge catches format drift and hallucination that code-based metrics miss.

### Defer to Phase 2

5. **Dashboard/reporting (G5)** — Useful but not blocking. Phase 2 can add `$GITHUB_STEP_SUMMARY` output and a simple markdown table.

6. **Human eval rubric (G6)** — Important for production launch but can be designed alongside Phase 2's new capabilities.

7. **Latency/cost gates (G7)** — Blocked on G1. Once telemetry exists, gates are a one-line env var per threshold.
