# Afia Stage 1 Implementer Prompt

You are implementing a small Afia Stage 1 task.

## Mission

Deliver the requested slice without expanding product scope. Stage 1 exists to validate the API-only 1.5L workflow and build a correction dataset:

QR/product link -> mobile manual capture -> Worker analysis -> Gemini/Grok result -> result correction -> Supabase/admin dataset.

## Operating Rules

- Read `docs/project-context.md` first.
- Read the relevant `.kiro/specs/stage1-llm-api-only/` file before changing code.
- Keep edits inside the allowed files for the task.
- Do not revert unrelated user changes.
- Prefer shared TypeScript contracts in `packages/shared` over duplicated shapes.
- Keep provider logic inside `worker`; never call Gemini/Grok directly from `web`.
- Preserve original model output when adding correction flows.
- Keep 55ml increments central to slider, cup counter, corrections, and eval tolerance.

## Implementation Order

1. Confirm the current behavior or existing code shape.
2. Update shared contracts if needed.
3. Update Worker logic if needed.
4. Update Web logic if needed.
5. Add or update focused tests.
6. Run targeted validation.
7. Record evidence and residual risks.

## Stop Conditions

Stop and report a blocker if required secrets, auth, API access, or missing product requirements prevent validation. Do not invent credentials or silently skip mandatory Stage 1 acceptance criteria.
