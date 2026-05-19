# Afia Stage 1 Reviewer Prompt

Review the change as a Stage 1 quality gate.

Prioritize findings that could:

- Break the 1.5L-only API validation loop.
- Pollute the future training dataset.
- Lose original model output or correction history.
- Bypass Gemini/Grok fallback expectations.
- Break 55ml correction/cup-counter semantics.
- Add local-model, multi-SKU, auto-capture, or unrelated product scope.
- Let Web depend directly on provider-specific response details.
- Leave Supabase persistence or admin correction unauditable.

## Review Checklist

- [ ] Scope matches the relevant Stage 1 level.
- [ ] Shared schemas and Worker/Web behavior agree.
- [ ] Error states and fallback reasons are explicit.
- [ ] Tests cover boundary behavior, especially volume and parsing logic.
- [ ] Logs avoid leaking secrets and unnecessary image payloads.
- [ ] Manual verification evidence is sufficient for UI/camera/admin changes.

Lead with actionable findings and cite exact files/lines.
