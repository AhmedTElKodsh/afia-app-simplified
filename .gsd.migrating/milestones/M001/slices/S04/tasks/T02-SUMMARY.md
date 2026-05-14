---
id: T02
parent: S04
milestone: M001
key_files:
  - worker/src/llm/gemini.ts
  - worker/src/routes/analyze.ts
  - worker/src/eval/probe-gemini-frame.ts
key_decisions:
  - Set default thinkingBudget to 1024 in gemini.ts so CoT activates for all callers without explicit config
  - Updated route SYSTEM_TEXT to ask for reasoning before JSON instead of "Return strict JSON only"
duration:
verification_result: passed
completed_at: 2026-05-13T19:00:00.000Z
blocker_discovered: false
---

# T02: Implement visual reasoning (CoT) logic

**Updated prompts and production routes to require visual reasoning before JSON output.**

## What Happened

The system.md already had a strong CoT instruction, and gemini.ts already supported thinkingBudget. The gap was that no caller passed a thinkingBudget (defaulted to 0), and the production route (`routes/analyze.ts`) used "Return strict JSON only" which would suppress any reasoning output.

Changes made:

1. **`worker/src/llm/gemini.ts`** — Changed `thinkingBudget` default from `0` to `1024` tokens. This enables Gemini's native thinking capability for all callers without explicit config. `??` operator means explicit `0` still disables it.

2. **`worker/src/routes/analyze.ts`** — Updated SYSTEM_TEXT and USER_TEXT to ask for visual reasoning description before the JSON block, instead of "Return strict JSON only". The `parseEvidenceResponse` parser already handles text-before-JSON gracefully (finds first `{` / last `}`).

3. **`worker/src/eval/probe-gemini-frame.ts`** — Removed "No prose. No markdown." restriction that contradicted CoT. Added reasoning instruction to both systemInstruction and prompt.

## Verification

All callers now:
- Default to 1024 token thinking budget (unless explicitly set to 0)
- Prompt the model to describe visual evidence before outputting JSON
- Have compatible parsers that strip reasoning text before JSON parsing

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- worker/src/llm/gemini.ts
- worker/src/routes/analyze.ts
- worker/src/eval/probe-gemini-frame.ts
