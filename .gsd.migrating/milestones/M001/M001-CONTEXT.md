# M001: Stage 1 Remediation & Accuracy Boost

**Gathered:** 2026-05-13
**Status:** Ready for planning

## Project Description

This milestone focuses on improving the measurement accuracy of the Afia Oil Level Scanner for 1.5L bottles. Initial evaluations showed that the model was heavily anchoring to few-shot example values rather than performing true visual analysis of the target images, resulting in high-confidence errors.

## Why This Milestone

The core value of the product depends on trustworthy measurements. The baseline execution in S01 revealed a 0% exact accuracy rate, necessitating a remediation phase to refine prompts, expand reference anchors, and implement a reasoning-first approach to visual feature detection.

## User-Visible Outcome

### When this milestone is complete, the user can:

- Receive an oil level measurement that is within ±50ml of the actual volume (targeting ±10ml as the ideal threshold).
- See more realistic confidence scores that reflect actual visual clarity rather than model hallucinations.

### Entry point / environment

- Entry point: `pnpm eval:probe` (CLI) and Cloudflare Worker API.
- Environment: Local development for evals; Cloudflare Workers for live testing.
- Live dependencies involved: Gemini API (primary), Grok API (fallback).

## Completion Class

- Contract complete means: Probe set evaluation shows accuracy within the target ±50ml margin for all 12 fixtures.
- Integration complete means: Prompt refinements and few-shot expansions are deployed to the Worker and used in live scan requests.

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- The model can correctly identify the meniscus even when it doesn't match a few-shot anchor exactly.
- The `oilSurfaceYRatio` is calculated based on visual evidence described in the response's reasoning chain.
- Accuracy metrics on the 12-image probe set show consistent improvement over the S01 baseline.

## Architectural Decisions

### Visual Reasoning Chain

**Decision:** Require the model to describe the visual evidence (e.g., meniscus curve, liquid surface line) before outputting the final JSON coordinate.

**Rationale:** To break the anchoring bias where the model simply repeats numbers from few-shots. Forcing a description encourages the model to attend to the target image pixels.

**Alternatives Considered:**
- Increasing few-shots — Might actually increase anchoring if the variety isn't massive.
- Fine-tuning — Not feasible for Stage 1 LLM API usage.

## Error Handling Strategy

Strict Quota Fallback: The system uses multiple Gemini keys in rotation. If Gemini returns a quota error or timeout after retries, the system falls back to the Grok API to ensure the user receives a result.

## Risks and Unknowns

- **Anchoring Persistence** — The model may still favor few-shots despite reasoning prompts.
- **Lighting Variability** — Heavy glare in probe images might make the ±10ml target difficult to reach without local model preprocessing (Stage 2).

## Existing Codebase / Prior Art

- `worker/src/prompt/v1/system.md` — Current measurement rules.
- `worker/src/prompt/v1/bottle-reference.md` — Coordinate system and calibration anchors.
- `runs/*.jsonl` — Baseline performance data from S01.

## Relevant Requirements

- R001 — Accurate oil level estimation (Directly advances this core capability).

## Scope

### In Scope

- Prompt engineering (Reasoning Chain).
- Few-shot anchor expansion.
- Probe set validation (12 images).
- ML error margin reduction (Targeting ±10ml).

### Out of Scope / Non-Goals

- Local model development (Stage 2).
- Image storage or persistence.
- Admin correction interface (Stage 1.5/2).

## Technical Constraints

- Must run within Cloudflare Worker limits (CPU/Memory).
- Must handle Gemini API rate limits via rotation and fallback.

## Testing Requirements

- Every prompt change must be validated against the `probe` set using the eval runner.
- Success is measured by the reduction in `y-ratio` delta compared to the S01 baseline.

## Acceptance Criteria

- **S02 Accuracy:** Probe results show error reduced to < ±50ml.
- **S02 Robustness:** Model provides "uncertain" or low confidence when the meniscus is genuinely hidden, rather than guessing a few-shot value.
- **S03 Full Validation:** Full dev set results show similar accuracy trends to the probe set.
