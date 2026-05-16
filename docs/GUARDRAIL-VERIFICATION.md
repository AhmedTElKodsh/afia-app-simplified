# Guardrail Verification: `eval:dev-quick` Regression Detection

**Date:** 2026-05-15  
**Commit:** No permanent changes (break → test → revert)

## Objective

Prove that `eval:dev-quick` (the 12-fixture probe manifest) actually catches regressions in the ML pipeline by running it against deliberately broken code.

## Method

1. Injected a surgical break into `worker/src/llm/analyze.ts` — short-circuited the `analyzeFixture()` function to return a hardcoded wrong prediction (`remainingMl: 1000`) with zero confidence, bypassing all LLM calls so the eval runs instantly.
2. Ran `npm run eval:dev-quick` (→ `tsx src/eval/run.ts --manifest=worker/test/fixtures/dev/probe-manifest.json --label=dev-quick`)
3. Collected the output.
4. Reverted the break — exact `git diff` zeroed.

## Result

### Broken pipeline (all 12 fixtures)

```
exact (±55ml): 0/12 = 0.0%
close (±110ml): 0/12 = 0.0%
avg confidence: 0.00
avg abs error: 443.3ml
high-confidence misses: 0

per-stratum exact:
  all 12 strata: 0.0%

per-source:
  aug: 0/4 = 0.0%
  real: 0/8 = 0.0%

confusion bands:
  low→high: 3    (catastrophic — empty predicted as full)
  mid→high: 5    (catastrophic — partial predicted as full)
  high→high: 4   (wrong magnitude)

worst miss: 1000ml error (empty bottle predicted as 1000ml)
```

### Every fixture showed `✗`

Every line in the `eval:dev-quick` output showed a failure indicator. The per-fixture granularity means you can see exactly which strata, fill buckets, and frame buckets are affected.

## What the failure signal looks like

The eval runner itself exits with code 0 (it's a measurement tool, not a pass/fail gate). The regression signal is in the output:

- **The headline rate:** `exact: 0/12 = 0.0%` is an unmistakable regression from any healthy baseline
- **Per-stratum zeros:** Shows the regression is systematic, not a few bad apples
- **Confusion bands:** Reveal the direction of error (all predicted as "high" band)
- **Worst misses:** Pinpoint the most egregious failures with raw LLM output for debugging

A CI/CD gate can parse these numbers and fail the build if `exact < 20%` or `avg abs error > 200ml`.

## Conclusion

**The guardrail works.** `eval:dev-quick` unambiguously detected the regression with:
- 100% failure rate across all 12 fixtures
- Clear directional signal in confusion bands
- Per-fixture detail for root-cause analysis
- Deterministic, repeatable output (short-circuited break produced identical results on each run)
