# Afia Stage 1 — Quick Start Guide

## Overview

**Goal:** Validate LLM-powered oil level analysis pipeline with minimal complexity.

**Scope:** 15 tasks, ~3-5 days of focused development.

**Out of Scope:** Persistence, multi-key rotation, admin corrections (deferred to Stage 2).

## Prerequisites

- Node.js 18+ and pnpm 9+
- Cloudflare account (for deployment)
- Gemini API key (Google AI Studio)
- Grok API key (X.AI)

## Quick Setup

```bash
# Clone and install
git clone <repo>
cd afia-app-simplified
pnpm install

# Start development
pnpm dev:web      # http://localhost:5173
pnpm dev:worker   # http://localhost:8787

# Run tests
pnpm test
```

## Task Sequence (15 Tasks)

### Phase 1: Foundation (Tasks 1-3)
**Time:** ~4 hours

1. **Monorepo skeleton** — pnpm workspace, Worker, Vite, shared types
2. **i18n + theme** — English/Arabic, dark mode, floating controls
3. **Admin QR generator** — Generate QR codes for 1.5L and 2.5L bottles

**Checkpoint:** `pnpm test` passes, admin can generate QR codes

---

### Phase 2: Consumer Flow (Tasks 4-6)
**Time:** ~3 hours

4. **Scan landing** — QR redirect to capture page
5. **Bottle outline** — Static SVG overlay for 1.5L bottle
6. **Camera capture** — getUserMedia with iOS-safe video, manual capture button

**Checkpoint:** Can scan QR → see camera → capture photo

---

### Phase 3: API Scaffold (Task 7)
**Time:** ~1 hour

7. **Worker /api/analyze** — POST endpoint with stub response

**Checkpoint:** `curl -X POST /api/analyze` returns stub result

---

### Phase 4: LLM Pipeline (Tasks 8-10) ⚠️ HIGH-RISK
**Time:** ~6-8 hours

8. **Prompt + parser** — System prompt, bottle reference, Zod validation
9. **Gemini + Grok clients** — Single-key Gemini with Grok fallback, retry logic
10. **Wire orchestrator** — Replace stub with real LLM calls

**Checkpoint:** Real bottle image → LLM analysis → JSON result

**⚠️ Critical:** Test with real API keys and sample images before proceeding.

---

### Phase 5: Result UI (Tasks 11-13)
**Time:** ~4 hours

11. **Result page** — Display image with red line overlay, ml values
12. **Cup math** — Convert ml to cups (220ml = 1 cup, 55ml = 1/4 cup)
13. **OilSlider** — Adjust ml in 55ml steps, show cup counter

**Checkpoint:** Full consumer flow works end-to-end

---

### Phase 6: Admin + Deploy (Tasks 14-15)
**Time:** ~2 hours

14. **Admin review queue** — Placeholder UI (no data in Stage 1)
15. **Deploy + smoke test** — Cloudflare deployment, Playwright e2e

**Checkpoint:** Deployed to production, smoke tests pass

---

## Critical Path

The **LLM pipeline (Tasks 8-10)** is the highest-risk cluster. Recommendations:

1. **Start with Task 8** (parser) — Write comprehensive tests for malformed JSON
2. **Test Task 9** (orchestrator) with real API keys and sample images
3. **Only proceed to Task 10** once orchestrator reliably returns valid JSON

## Testing Strategy

### Unit Tests
- Parser: Malformed JSON, missing fields, out-of-range values
- OilSlider: Boundary conditions (0ml, 1500ml, partial cups)
- Cup math: Edge cases (0ml, 220ml, 55ml, 1500ml)

### Integration Tests
- Orchestrator: Real API calls with test images (optional but recommended)
- /api/analyze: End-to-end with mocked orchestrator

### E2E Smoke Tests
- Health endpoint returns 200
- Scan page redirects to capture
- Admin QR generator loads

## Common Pitfalls

### 1. iOS Camera Issues
**Problem:** Video doesn't display on iOS Safari
**Solution:** Ensure `playsinline` attribute on `<video>` element

### 2. LLM Returns Markdown
**Problem:** Parser fails because LLM wraps JSON in ```json...```
**Solution:** Strip markdown fences in `parse-response.ts`

### 3. Gemini Rate Limits
**Problem:** 429 errors during testing
**Solution:** Implement retry with backoff (already in orchestrator)

### 4. CORS Errors in Dev
**Problem:** Vite can't reach Worker API
**Solution:** Vite proxy configured in `web/vite.config.ts`

## Secrets Management

### Development (Local)
```bash
# Create .dev.vars in worker/
GEMINI_API_KEY=your-key-here
GROK_API_KEY=your-key-here
ADMIN_TOKEN=test-token
```

### Production (Cloudflare)
```bash
wrangler secret put GEMINI_API_KEY
wrangler secret put GROK_API_KEY
wrangler secret put ADMIN_TOKEN
```

## Deployment Checklist

- [ ] Set secrets in Cloudflare
- [ ] Build web: `pnpm --filter web build`
- [ ] Deploy worker: `pnpm --filter worker deploy`
- [ ] Test health endpoint: `curl https://your-worker.workers.dev/api/health`
- [ ] Test full flow: Scan QR → capture → analyze
- [ ] Run smoke tests: `pnpm run e2e`

## Stage 2 Preview

After Stage 1 is validated, Stage 2 will add:

- **Supabase persistence** — Store analyses and images
- **Multi-key rotation** — Scale Gemini API usage
- **Admin corrections** — Review and correct LLM results
- **Training corpus** — Export data for local model training

## Support

- **Plan:** `docs/superpowers/plans/2026-05-06-afia-stage1-simplified.md`
- **Changes:** `docs/superpowers/plans/STAGE1-CHANGES.md`
- **Complexity Analysis:** See conversation summary (BMAD Party Mode results)

