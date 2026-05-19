---
tracker:
  kind: memory
  active_states:
    - Todo
    - In Progress
    - Rework
  terminal_states:
    - Done
    - Cancelled
polling:
  interval_ms: 15000
workspace:
  root: ~/code/afia-symphony-workspaces
hooks:
  after_create: |
    pnpm install --frozen-lockfile
  before_run: |
    pwsh .symphony/hooks/preflight.ps1
  after_run: |
    pwsh .symphony/hooks/verify.ps1
agent:
  max_concurrent_agents: 2
  max_turns: 8
codex:
  command: codex --config shell_environment_policy.inherit=all app-server
  approval_policy: never
  thread_sandbox: workspace-write
  turn_sandbox_policy:
    type: workspaceWrite
---

You are working on the Afia Oil Level Scanner Stage 1 project.

## Product Goal

Stage 1 validates the API-only 1.5L Afia bottle flow:

QR/product link -> mobile manual capture -> Worker `POST /api/analyze` -> Gemini/Grok API analysis -> result UI -> user/admin correction -> Supabase dataset.

## Hard Scope

- Support 1.5L bottle analysis only.
- Keep 2.5L limited to routing and unsupported messaging.
- Use manual capture only; do not add required auto-capture.
- Use API LLM analysis only; do not add local model inference or training.
- Treat Supabase persistence and admin correction as core Stage 1 work.
- Preserve 55ml as the primary correction/evaluation unit unless a spec explicitly changes it.
- Do not add marketplace, accounts, loyalty, inventory, nutrition, or multi-SKU product scope.

## Repo Boundaries

- `packages/shared/`: shared constants, product-link helpers, request/result schemas, and unit math.
- `worker/`: Cloudflare Worker routes, Hono app, provider rotation/fallback, parsing, Supabase persistence, admin API.
- `web/`: React/Vite capture shell, result UI, admin UI, theme/language controls, mobile ergonomics.
- `.kiro/specs/`: source of truth for Stage 1 requirements, design, and task sequencing.
- `docs/project-context.md`: compact project context for agents and reviewers.

When a task changes a cross-boundary contract, update in this order:

1. Shared types/constants.
2. Worker validation and route behavior.
3. Web consumers and UI states.
4. Tests and documentation.

## Required Workpad

For every task, keep a short workpad in the ticket, PR, or local task note with:

- Goal.
- Allowed files.
- Acceptance criteria copied from the relevant spec.
- Risks to data quality or product scope.
- Verification evidence.
- Blockers, if any.

## Quality Gates

### Scope Gate

Before editing, identify the Stage 1 level touched: 1.0 eval, 1.1 QR shell, 1.2 capture, 1.3 API analysis, 1.4 result UI, 1.5 Supabase/admin, or 1.6 pilot gates.

Reject or split work that expands beyond the chosen level without explicit user approval.

### Capture Gate

Changes touching camera/capture must preserve:

- Environment-facing camera preference.
- Manual capture button.
- Upright 1.5L guide with visible margin around the bottle.
- Downward phone-angle instruction.
- Permission-denied and missing-camera recovery states.
- No overlap between guide, controls, upper instructions, theme toggle, and language toggle.

### LLM Analysis Gate

Changes touching analysis must preserve:

- Gemini first, multi-key rotation when configured.
- Grok fallback for provider failure, quota exhaustion, or low-confidence result.
- Strict JSON parsing and schema validation.
- Provider, prompt version, model version, fallback reason, warnings, confidence, and raw metadata logging.
- No direct provider calls from `web/`.

### 55ml Gate

Any volume, slider, cup-counter, or tolerance change must include deterministic checks around 55ml increments and edge values near empty/full 1.5L boundaries.

### Persistence Gate

Supabase writes must preserve:

- Original captured image reference.
- Normalized analysis result.
- Raw provider metadata safe for storage.
- Prompt/model version.
- Correction status.
- Admin-corrected remaining ml.
- Audit trail fields where available.

### Admin Correction Gate

Admin corrections are training labels. Preserve before/after values and reason codes. Never overwrite the original model output when storing a correction.

### Human Approval Gate

Do not auto-merge Stage 1 changes. Symphony-style orchestration may prepare isolated work and draft PRs, but human review remains required before merge.

## Default Execution Flow

1. Read `docs/project-context.md`.
2. Read the relevant files in `.kiro/specs/stage1-llm-api-only/`.
3. Check `git status --short` and avoid reverting unrelated user changes.
4. Reproduce or inspect the current behavior before editing.
5. Implement the smallest slice that satisfies the task.
6. Run focused tests first, then `pnpm test` and `pnpm build` when practical.
7. Record verification evidence and any residual risk.

## Final Response Requirements

Report only:

- What changed.
- What validation ran.
- Any blockers or residual risks.

Do not suggest local-model, multi-SKU, or broad product expansion as next steps unless the user explicitly asks.
