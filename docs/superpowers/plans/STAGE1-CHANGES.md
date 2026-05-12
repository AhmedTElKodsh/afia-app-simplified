# Afia Stage 1 Plan — Re-Scoping to Eval-Only Spike

## Summary

Stage 1 is re-scoped from a deployable consumer app to a **research spike** that validates the Gemini ml-prediction pipeline against a sealed ground-truth fixture set. All consumer UX, deployment, persistence, and admin features move to Stage 2.

The previous "simplification" (single Gemini key, no Supabase, no admin corrections) was the right *direction* but stopped halfway: it kept the camera, the SPA, the routing, and a vibes-based success criterion ("consumer can scan QR → see result"). That criterion does not answer the only question Stage 1 exists to answer: **does Gemini work well enough on real Afia bottle images to fund Stage 2?**

This document records the second-pass re-scoping that followed the BMAD party-mode critique on 2026-05-07.

## Stage 1 Kill Condition (Single Source of Truth)

Stage 1 ends when **both** conditions are met:

1. **Measurable bar (Murat):** Gemini predictions on a sealed 40-image held-out set achieve:
   - ≥90% **exact-bucket accuracy** (predicted ml within ±55ml of the folder-name ground truth — i.e. one quarter-cup tolerance)
   - ≥80% exact-bucket accuracy on **every individual stratum** (anti-gaming gate)
   - Byte-stable JSONL hash on ≥38/40 fixtures across 3 runs at `temperature=0`
   - Prompt + few-shots + comparator + fixture manifest committed at a tagged SHA
2. **Adjudication gate (John):** A domain reviewer signs off on the 40 predictions as "trustworthy enough to fund Stage 2 UX investment." Sign-off is recorded in `runs/signoffs.jsonl`.

Metric is necessary, not sufficient. No reviewer sign-off = no Stage 2.

## Fixture Corpus (Existing Local Data)

Source: `oil-bottle-frames/` (real video-frame extractions) and `oil-bottle-augmented/` (AI-augmented variants).

- **28 ml-level folders** in 55ml steps: `55ml`, `110ml`, …, `1500ml`, plus `empty` (augmented only)
- Ground truth is **encoded in the folder name** — no separate label files needed
- Real: ~41 frames per level (~1,148 total)
- Augmented: ~533 frames per level (~14,924 total)
- Reference shots: `oil-bottle-frames/1.5L_refs/` (1500ml, 750ml, 55ml, empty)

### Stratification (4 axes, 100 fixtures total: 60 dev / 40 holdout)

| Axis | Buckets |
|---|---|
| Source | real, augmented |
| Fill level | empty/low (0–275ml), mid-low (330–770ml), mid-high (825–1210ml), high (1265–1500ml) |
| Frame index | early (t < 5s), late (t ≥ 5s) — proxy for lighting/orientation drift in real frames |
| Sample id | per-cell stratified random draw with fixed seed |

Holdout sealing: 40 fixtures are drawn once, written to `worker/test/fixtures/holdout/manifest.json`, and never touched by prompt iteration. A reserve pool is set aside for re-draws if the seal breaks.

## Cuts vs. Previous Plan

The following tasks are **removed from Stage 1** and deferred to Stage 2:

| Task | Old # | Reason |
|---|---|---|
| i18n + theme + FloatingControls | 2 | UX, no user in Stage 1 |
| Admin QR generator | 3 | UX, deferred |
| Scan landing | 4 | UX, deferred |
| BottleOutline SVG | 5 | UX, deferred |
| CameraCapture | 6 | No camera input in Stage 1 — fixtures only |
| Result page | 11 | UX, deferred |
| Cup math | 12 | UX, deferred |
| OilSlider + CupCounter | 13 | UX, deferred |
| Admin review queue | 14 | UX, deferred |
| Cloudflare deploy + e2e smoke | 15 | No deploy target in Stage 1 |

## Surviving + Modified Tasks

| New # | Old # | Task | Change |
|---|---|---|---|
| 1 | 1 | Monorepo skeleton | **Stripped** — worker-only, no `web/` package in Stage 1 |
| 2 | 8 | Versioned prompt + few-shots + parser | **Modified** — externalize prompt to `worker/src/prompt/v1/system.md`, few-shots as `worker/src/prompt/v1/few-shots/*.json`, hash both per run |
| 3 | 9 | Gemini client | **Modified** — drop Grok fallback (non-determinism source), pin `temperature: 0`, use `responseSchema` for structured output |
| 4 | 10 | Wire orchestrator | **Repurposed** — drop HTTP route, expose `analyzeFixture(imagePath, env)` callable from CLI |

## New Stage 1 Tasks (None Existed Before)

| # | Task |
|---|---|
| 5 | Fixture manifest + dev/holdout split (seeded, sealed) |
| 6 | Comparator module (±55ml exact-bucket, ±110ml close, >110ml miss) — committed before fixtures are scored |
| 7 | JSONL run-record schema (Supabase-ingestion-shape compatible) |
| 8 | Eval runner CLI: `pnpm eval:dev` |
| 9 | Eval runner CLI: `pnpm eval:holdout` (touch counter, seal enforcement) |
| 10 | Stage 1 exit-gate script + reviewer sign-off recording |

## Schema Decisions Frozen Now (Defer DB, Not Contract)

`AnalysisResult` (in `packages/shared/src/types.ts`) gains: `promptHash`, `fewshotHash`, `modelId`, `runId`, `imageId`, `stratum`. These are required by JSONL run-records and must match the eventual Supabase `analyses` table schema. Database is deferred; data shape is not.

JSONL run-record fields (one row per fixture per run):

```
run_id, run_started_ts, prompt_hash, fewshot_hash, model_id, model_version,
image_id, image_path, stratum, ground_truth_ml,
raw_output, parsed_ml, parsed_confidence,
abs_error_ml, exact_bucket_pass, close_bucket_pass,
comparator_name, comparator_version, holdout_touches
```

## File Structure Changes

### Removed from Stage 1 (deferred)
```
web/                                 # entire SPA package
worker/src/llm/grok.ts
e2e/                                 # Playwright
playwright.config.ts
```

### Added in Stage 1
```
worker/src/prompt/v1/system.md
worker/src/prompt/v1/bottle-reference.md
worker/src/prompt/v1/few-shots/*.json
worker/src/eval/compare.ts           # ±55ml comparator
worker/src/eval/manifest.ts          # fixture sampler + seal
worker/src/eval/run.ts               # CLI entry
worker/src/eval/signoff.ts           # reviewer gate
worker/test/fixtures/dev/manifest.json
worker/test/fixtures/holdout/manifest.json
runs/.gitkeep                        # JSONL output dir (gitignored except .gitkeep)
runs/signoffs.jsonl                  # reviewer decisions
```

### Modified
```
packages/shared/src/types.ts         # add hash + run-record fields
worker/src/llm/orchestrator.ts       # rename to analyzeFixture, drop HTTP
worker/src/llm/gemini.ts             # temperature: 0, responseSchema
worker/wrangler.jsonc                # remove Static Assets binding (no SPA in Stage 1)
```

## Stage 2 Roadmap (Promoted from Stage 1)

When Stage 1 passes its kill condition, Stage 2 will add:

1. **Consumer UX** (was Stage 1 Tasks 2–6, 11–13)
   - i18n, theme, scan landing, camera capture, bottle outline overlay, result page, slider, cup counter
2. **Cloudflare deployment** (was Stage 1 Task 15)
   - Worker + Static Assets, secrets, smoke test
3. **Supabase persistence**
   - `analyses` table matching the JSONL schema frozen in Stage 1
   - `bottle-images` storage bucket
4. **Multi-key Gemini rotation** + **Grok fallback**
5. **Admin review queue + corrections + manual upload**
6. **2.5L bottle path**
7. **Local on-device model** (Stage 3)

## Why This Re-Scoping

From the round-1+2 BMAD critique:
- **John (PM):** Stage 1 with no user is a research spike. Calling it "Stage 1" implies a job-to-be-done that doesn't exist. Strip the camera, kill the UX, define the kill condition.
- **Murat (TEA):** The previous "Success Criteria" were vibes. Without a sealed held-out set, a comparator written before scoring, and version provenance in every run-record, "passing Stage 1" measures nothing.
- **Winston (Architect):** Defer the database, freeze the data contract. Otherwise Supabase migration becomes a rewrite.
- **Amelia (Dev):** Camera before any UX is yak-shaving. Use fixtures. Pick the runtime now.

## Success Criteria for Stage 1 (Replacing Old List)

Stage 1 is complete when:
- ✅ 100 fixtures sampled and stratified across 4 axes, manifest committed
- ✅ Holdout seal: 40 fixtures untouched during prompt iteration
- ✅ Versioned prompt + few-shots committed; both hashed in every run-record
- ✅ Comparator module committed before holdout is scored
- ✅ Three sealed-holdout runs at `temperature=0` produce byte-stable JSONL on ≥38/40 fixtures
- ✅ Aggregate exact-bucket accuracy ≥90% on holdout
- ✅ Per-stratum exact-bucket accuracy ≥80% on every stratum
- ✅ Reviewer sign-off recorded in `runs/signoffs.jsonl`
- ✅ JSONL schema matches the planned Supabase `analyses` table

**Not required for Stage 1:**
- ❌ Any web UI
- ❌ Any HTTP endpoint
- ❌ Any deployment
- ❌ Persistent storage
- ❌ Camera input
- ❌ Grok fallback or multi-key rotation
- ❌ 2.5L bottle support
