# Phase 1: Staging Environment & Eval Harness — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in 01-CONTEXT.md — this log preserves the discussion.

**Date:** 2026-05-15
**Phase:** 01-staging-environment-eval-harness
**Mode:** discuss (with BMAD agent party reviews)
**Areas discussed:** CI/CD Pipeline Structure, Wrangler Environment Split, Eval-in-CI Approach, Fallback UX, Secrets Across Environments

## Discussion Summary

### CI/CD Pipeline Structure
- **Options presented:** A (single workflow staged jobs), B (multi-workflow CI+CD), C (PR-based with staging)
- **Agents consulted:** John (📋), Amelia (💻), Winston (🏗️), Murat (🧪)
- **Split opinion:** John+Winston preferred B, Amelia+Murat preferred A
- **User selected:** A — Single workflow with stages
- **Consensus details:**
  - Push/PR: lint + test + eval:dev-quick (10 samples, ~$0.50)
  - Merge to main: full eval:dev (40) + eval:holdout (36) + deploy staging
  - Nightly: full eval:dev + eval:holdout for drift
  - Path-filtering on quick eval (only on src/eval changes)
  - Signoff stays manual (human reviews JSONL)

### Wrangler Environment Split
- **Options presented:** A (workers.dev for staging), B (same worker swap secrets), C (separate configs)
- **Agents consulted:** Winston (🏗️), Amelia (💻), John (📋), Murat (🧪)
- **Result:** Unanimous A — workers.dev for staging
- **Details:** Current `afia-stage1.workers.dev` IS staging. No `--env` split until Phase 5.

### Eval-in-CI Approach
- **Options presented:** A (quick on push, full on merge, nightly drift), B (quick only, full manual), C (no eval in CI)
- **Agents consulted:** Winston (🏗️), Amelia (💻), John (📋), Murat (🧪)
- **Result:** Unanimous A — with Murat adding holdout on merge too, not just nightly
- **User accepted:** Yes

### Fallback UX When Inference Fails
- **Options presented:** A (rescan redirect), B (degraded results), C (error with retry + contact)
- **Agents consulted:** Sally (🎨), Winston (🏗️), John (📋), Amelia (💻)
- **Result:** Unanimous B — degraded results view
- **Implementation:** Persist structured `{ errors, tier, confidence }` to sessionStorage from CaptureShell. ResultShell branches on tier/errors. ~40 lines new components. No backend changes.

### Secrets Across Environments
- **Options presented:** Separate secret sets, same keys, Mix (shared Gemini + separate Supabase)
- **User selected:** Mix — shared Gemini/Grok keys, separate Supabase instances
- **Details:** CI eval runs against same key pool. Staging gets own Supabase project. Service role key fix deferred to Phase 4.

## Deferred Ideas
- Multi-workflow CI/CD split — Phase 5
- Production domain setup — Phase 5
- Supabase service role key split — Phase 4
- Provider circuit breaker — Phase 5
- Admin dashboard UI — v2 milestone
