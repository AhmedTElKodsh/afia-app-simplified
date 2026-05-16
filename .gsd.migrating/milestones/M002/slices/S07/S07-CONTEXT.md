# S07: LLM Validation Layer — Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

LLM validates low-confidence CV+REG outputs. Key constraint: LLM flags uncertainty, doesn't override measurements. 2s timeout, if exceeded → proceed without validation.

LLM call uses existing Gemini rotation + Grok/OpenRouter fallback from M001 codebase. New field `llmValidation` in response.
