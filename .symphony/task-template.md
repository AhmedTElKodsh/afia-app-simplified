# Afia Symphony Task Template

## Goal

One sentence describing the Stage 1 outcome.

## Stage 1 Level

- [ ] 1.0 Eval-only Gemini spike
- [ ] 1.1 QR/product identity shell
- [ ] 1.2 Camera capture
- [ ] 1.3 API analysis service
- [ ] 1.4 Result UI, slider, cup counter
- [ ] 1.5 Supabase/admin correction dataset loop
- [ ] 1.6 Field pilot and quality gates

## Allowed Files

- [ ] `packages/shared/**`
- [ ] `worker/**`
- [ ] `web/**`
- [ ] `.kiro/specs/**`
- [ ] `docs/**`

List exact paths when possible.

## Acceptance Criteria

- [ ] Requirement/spec criteria copied here.
- [ ] Shared contract updated first if the task crosses Worker/Web boundaries.
- [ ] Worker route validates input and output when API behavior changes.
- [ ] Web UI covers loading, success, correction, failure, and retry states when UI behavior changes.
- [ ] Supabase writes preserve original model output plus correction fields when persistence changes.
- [ ] 55ml increments remain deterministic when volume logic changes.

## Out of Scope

- Local model inference or training.
- Serious 2.5L analysis.
- Required auto-capture.
- Multi-product catalog expansion.
- Marketplace, account, loyalty, inventory, or nutrition features.

## Risk Notes

- Data quality risk:
- Product scope risk:
- Provider/fallback risk:
- Persistence/admin risk:

## Verification Plan

- [ ] Focused unit/component/API tests:
- [ ] Manual verification:
- [ ] `pnpm test` if practical.
- [ ] `pnpm build` if practical.

## Evidence

Record commands, outputs, screenshots, API samples, or manual notes.
