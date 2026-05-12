# Symphony Setup for Afia Stage 1

## Recommendation

Use OpenAI Symphony as an engineering harness for Afia, not as product runtime infrastructure.

For the current project state, Symphony is useful because it standardizes how Codex-style agents receive work, read Stage 1 context, preserve scope, and run validation. It should stay outside the deployed Cloudflare Worker and React app.

Do not run a long-lived polling daemon until the project has:

- Stable Stage 1 issue backlog.
- CI that runs the required checks.
- A chosen tracker integration such as Linear.
- Human review capacity for agent-created PRs.

## What Was Added

- `.symphony/WORKFLOW.md`: Afia-specific workflow configuration and prompt policy.
- `.symphony/task-template.md`: small-ticket template for Stage 1 agent tasks.
- `.symphony/prompts/`: implementation and review prompts for Afia Stage 1.
- `.symphony/hooks/preflight.ps1`: local readiness hook.
- `.symphony/hooks/verify.ps1`: validation hook.

## How To Use It Manually

1. Create a small task using `.symphony/task-template.md`.
2. Copy acceptance criteria from `.kiro/specs/stage1-llm-api-only/requirements.md`.
3. Give Codex the task plus `.symphony/WORKFLOW.md`.
4. Keep the task constrained to the allowed files.
5. Run focused tests while developing.
6. Run `.symphony/hooks/verify.ps1` before handoff when practical.

## Optional Future Symphony Daemon Setup

If Afia later needs automated issue execution, clone and run `openai/symphony` separately from this repo. Point its workflow file at this repository and adapt `.symphony/WORKFLOW.md` into the orchestrator's expected `WORKFLOW.md`.

Recommended initial daemon limits:

- `max_concurrent_agents: 1` until CI and review flow are stable.
- `max_turns: 4` for narrow implementation tickets.
- Human review required before merge.
- Tracker states limited to implementation/rework tickets only.
- No automatic land/merge flow.

## Afia-Specific Guardrails

- Stage 1 supports 1.5L analysis only.
- 2.5L must remain unsupported messaging unless the roadmap changes.
- Manual capture remains required.
- Local model work is out of scope.
- Supabase/admin correction is dataset infrastructure, not optional polish.
- 55ml is the central unit for evaluation, correction, slider steps, and cup counter behavior.

## Validation Expectations

Use the smallest validation that proves the changed behavior, then run broader checks before handoff when practical:

```powershell
pnpm --filter @afia/shared test
pnpm --filter worker test
pnpm --filter web test
pnpm build
```

Camera, result UI, and admin changes also need manual evidence because automated tests cannot fully prove mobile ergonomics or correction quality.
