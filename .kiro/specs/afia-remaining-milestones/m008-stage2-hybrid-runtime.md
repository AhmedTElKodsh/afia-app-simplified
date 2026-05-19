# M008 - Stage 2 Hybrid Runtime

Status: planned

## Goal

Make the local model the primary analysis route for supported 1.5L scans while keeping Gemini/Grok APIs as fallback and verification support.

This milestone should start only after M007 produces a model candidate that is accurate enough to justify runtime integration.

## Depends On

- M007 model candidate with sign-off evidence.
- Stable Stage 1 result contract.
- M006 admin/dataset loop.
- Existing Gemini multi-key rotation and Grok fallback.

## Scope

In scope:

- Analysis engine abstraction that can choose local, API, or hybrid result.
- Local model execution in the target runtime.
- API fallback on low confidence, poor quality, local/API disagreement, provider error, or unsupported product.
- Storage of local result, API fallback result, chosen result, disagreement, model version, dataset version, and quality tags.
- Admin review prioritization for low-confidence and disagreement cases.

Out of scope:

- Local-only launch.
- Removing API support.
- Functional auto-capture unless needed as a quality input.
- 2.5L support beyond identity.

## Slices

### S27 - Stable Analysis Engine Contract

Deliverables:

- Define a single analysis result contract across local, API, and hybrid paths.
- Keep fields stable: remaining ml, consumed ml, red-line ratio, confidence, warnings/errors, provider/source, model/prompt/dataset metadata, fallback reason.
- Ensure `/api/analyze` or its successor can return local, API, or hybrid provenance without breaking the web result screen.

Acceptance criteria:

- Web result UI does not need separate pages for local/API/hybrid.
- Admin records can distinguish local estimate, API fallback estimate, and final chosen estimate.

Verification:

- Shared schema tests.
- Worker route tests.
- Web flow tests with local, API, and fallback fixture responses.

### S28 - Local Primary Execution

Deliverables:

- Load the model in the selected runtime.
- Run inference on valid 1.5L captures.
- Return confidence and quality diagnostics.
- Fail closed when model assets are missing, incompatible, or low confidence.

Acceptance criteria:

- Valid 1.5L samples can complete through local inference.
- Invalid samples do not silently return confident wrong results.

Verification:

- Model loader tests.
- Runtime memory/latency checks.
- Fixture inference tests.

### S29 - API Fallback And Disagreement Policy

Deliverables:

- Define fallback triggers:
  - local confidence below threshold
  - poor image quality
  - wrong side or partial bottle
  - local/API disagreement above threshold
  - model/runtime error
  - unsupported or uncertain product identity
- Use Gemini key rotation first and Grok fallback after provider failure.
- Record fallback reason and both estimates.

Acceptance criteria:

- Fallback improves trust instead of hiding local failure.
- Admin can audit disagreement cases.

Verification:

- Unit tests for fallback decision table.
- Worker tests for Gemini/Grok route behavior.
- Admin UI tests for disagreement record display.

### S30 - Hybrid Admin And Active Learning

Deliverables:

- Queue low-confidence local results, large disagreements, and user corrections ahead of routine records.
- Track correction deltas by model version and dataset version.
- Add dashboard/report fields for fallback rate, correction rate, and rejection reasons.
- Define dataset refresh input for the next training cycle.

Acceptance criteria:

- Hybrid failures become training signals.
- Model updates can be evaluated against the records they changed.

Verification:

- Admin tests for priority/filtering.
- Dataset export includes model version and disagreement fields.

## Milestone Exit Gate

M008 is complete only when:

- Local inference is the primary path for valid 1.5L captures.
- API fallback is deterministic and logged.
- Result UI remains stable.
- Supabase/Admin records preserve both local and fallback evidence.
- Live/demo verification proves common scans work without depending on API for every successful case.

## Risks

| Risk | Mitigation |
| --- | --- |
| Local model returns confident wrong values. | Use conservative confidence thresholds and disagreement review. |
| API fallback masks bad local model quality. | Report fallback rate and correction deltas by model version. |
| Runtime model loading hurts mobile UX. | Track model size, caching, load time, memory, and inference latency. |
| Contract churn breaks result/admin UI. | Keep shared schema stable and test all providers. |

