# Legacy Planning Archive

## Purpose

This file records what was merged from the former `.planning` and `docs` trees before those folders were removed. It keeps the useful decisions without preserving competing source-of-truth folders.

## Current Source Of Truth

Use the active spec set in this order:

1. Roadmap overview and metrics gates.
2. Stage 1 API-only requirements, design, and tasks.
3. Remaining milestones packet.
4. Consumer UX requirements.
5. Stage 2 local-model requirements.
6. Project reference files in this folder.

Older documents that describe Stage 1 as eval-only, static-outline-only, or no-persistence are historical. They explain how the plan evolved, but they no longer define the active workflow.

## Merged From Former `.planning`

### Production Readiness Plan

The old production-readiness roadmap introduced five useful themes:

- CI/CD and evaluation harness.
- Heuristic improvements and ONNX feasibility.
- ONNX integration and accuracy gate.
- Observability and infrastructure hardening.
- Resilience and production launch.

These themes now map to the active staged plan as follows:

| Legacy Theme | Current Home |
| --- | --- |
| CI/eval harness | Metrics and gates, technical reference, remaining M005 proof. |
| Fallback UX | Stage 1 requirements and consumer UX requirements. |
| Supabase staging/security | Stage 1.5 and M006 dataset/admin loop. |
| ONNX feasibility | Stage 2 local-model requirements and technical reference. |
| Provider exhaustion | Stage 1 API fallback requirements and Worker tests. |
| Production launch | Stage 3 local-first/prelaunch plan. |

### Phase 1 Decisions

Retained decisions:

- Use staged CI jobs for tests, builds, evals, and deployment proof.
- Keep sign-off human-reviewed; do not automate product trust from metrics alone.
- Treat deployed Cloudflare and Supabase configuration as separate proof from local tests.
- Show degraded or clear failure states when inference fails.
- Use separate treatment for staging/production persistence so dataset pollution is visible.

Superseded decisions:

- Any assumption that the current Stage 1 has no product workflow.
- Any assumption that quality detection and auto-capture are out of scope for the current Stage 1 plan.

### Phase 2 Decisions

Retained decisions:

- Expand edge-case coverage across fill levels, lighting, glare, backgrounds, distance, and image quality.
- Keep model version metadata with ONNX hash, feature extractor version, prompt hash, and eval summary.
- Treat heuristic-only tuning as insufficient when it cannot meet the target error profile.
- Keep ONNX feasible as a candidate path, but require Workers/browser proof before production use.

Superseded decisions:

- "Proceed with ONNX integration" is no longer a direct next step. The current plan requires M006 dataset readiness and M007 accuracy remediation before M008 hybrid runtime.

## Merged From Former `docs`

### Project Context

The project context was merged into `project-context.md`. The important retained points are:

- The target user flow is QR/barcode to camera to API analysis to result correction to Supabase/admin dataset.
- Stage 1 remains API-first.
- 1.5L is the only analysis-supported bottle size.
- 2.5L identity is preserved but blocked from analysis.
- Supabase persistence and admin correction are product gates.
- Stage 2 requires dataset and accuracy proof before local model promotion.

### Comprehensive Documentation

The comprehensive architecture and runbook notes were merged into `technical-reference.md`. The retained value is:

- Stack and package map.
- Worker route roles.
- Supabase record contract.
- Capture quality rules.
- CV/ONNX status.
- Eval and deploy commands.
- Repository cleanup policy.

### CV Pipeline And ONNX Notes

The CV pipeline, ONNX decision gate, and phase summary docs were merged as planning evidence:

- CV remains useful for diagnostics, quality tagging, and future model work.
- ONNX feasibility was promising for small models but not enough for production support.
- Stage 1.5 accuracy was a NO-GO, so the next model work must be dataset-backed remediation.

### Model Training Pipeline

The model-training notes were merged into Stage 2 requirements and the technical reference:

- Train offline from trusted labels.
- Export a lightweight model for browser/mobile use only after gates pass.
- Preserve dataset/model versions.
- Use Gemini/Grok fallback when local confidence, image quality, or local/API agreement is weak.

### Guardrail Verification

The guardrail evidence was merged into metrics guidance:

- Evals should detect catastrophic regressions.
- 55ml is the primary pass unit.
- Broken-pipeline evidence is useful when it proves that the gate fails loudly.

### Agent Harness Notes

The Symphony/BMad notes were reduced to operating guidance:

- Agent task templates can help structure work.
- They must stay outside runtime architecture.
- Tests, builds, live endpoint checks, and phone/browser proof remain the real gates.

## Stale Claims Explicitly Retired

The following claims are retired and should not be reintroduced:

- Stage 1 is only a research spike with no UI.
- Stage 1 has no Cloudflare deployment.
- Stage 1 has no Supabase persistence.
- Stage 1 uses only a static bottle outline.
- Auto-capture and basic quality detection are out of scope.
- Working CV/ONNX diagnostics mean local inference is production-ready.
- 2.5L can share the 1.5L accuracy claim.

## Cleanup Decision

After this merge, `.planning` and `docs` are removed from the project tree. Future planning and reference updates should be made under `.kiro/specs` so the project has one durable planning home.
