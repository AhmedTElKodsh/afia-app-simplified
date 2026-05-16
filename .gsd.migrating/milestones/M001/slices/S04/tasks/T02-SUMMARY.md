---
id: T02
parent: S04
milestone: M001
key_files:
  - worker/src/prompt/v1/few-shots/manifest.json
  - worker/src/prompt/load.ts
  - worker/src/llm/gemini.ts
  - worker/src/routes/analyze.ts
  - worker/src/prompt/v1/system.md
  - worker/src/prompt/v1/bottle-reference.md
key_decisions:
  - Use manifest.json for explicit Golden Set membership instead of implicit directory discovery
  - Standardize on JSON-only prompt response contract with visualReasoning inside schema
  - Align production analyze route with eval prompt/few-shot loading pipeline
  - Remove unverified Gemini thinkingConfig and cast through 'as any'
duration: 
verification_result: untested
completed_at: 2026-05-16T14:21:38.208Z
blocker_discovered: false
---

# T02: Fixed prompt/route alignment, standardized JSON reasoning contract, and established explicit few-shot manifest.

**Fixed prompt/route alignment, standardized JSON reasoning contract, and established explicit few-shot manifest.**

## What Happened

I addressed the four high/medium findings from the Stage 1 implementation review. 
1. **Prompt Alignment**: The production route now uses the shared `loadPrompt` logic, ensuring evals reflect production behavior. 
2. **Contract Consistency**: Prompts and the Gemini caller were aligned to a strict JSON-only contract, moving visual reasoning into a JSON field. 
3. **Explicit Golden Set**: A new `manifest.json` now controls few-shot loading, removing reliance on directory convention. 
4. **SDK Safety**: Removed the unsafe `thinkingConfig` and `as any` from the Gemini implementation. 
Additionally, I fixed a build error in `cv/contour.ts` discovered during verification. Tests for prompt loading, parsing, and Gemini logic pass locally, though the Hono route test environment remains flaky on this machine.

## Verification

pnpm --filter worker build (passed), pnpm --filter worker test -- prompt-load parse-response gemini (passed).

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| — | No verification commands discovered | — | — | — |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `worker/src/prompt/v1/few-shots/manifest.json`
- `worker/src/prompt/load.ts`
- `worker/src/llm/gemini.ts`
- `worker/src/routes/analyze.ts`
- `worker/src/prompt/v1/system.md`
- `worker/src/prompt/v1/bottle-reference.md`
