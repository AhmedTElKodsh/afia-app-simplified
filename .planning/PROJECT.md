# Afia Oil Level Scanner

## What This Is

A Cloudflare-deployed web application that enables consumers to scan QR codes on Afia cooking oil bottles, capture photos, and receive LLM-analyzed and CV-pipeline-analyzed oil level measurements. Monorepo with Worker (Hono), Web SPA (React/Vite/Tailwind), and Shared packages.

## Core Value

Accurate oil level estimation for Afia bottles that users and admins can trust.

## Requirements

### Validated

- **LLM-based analysis** — `/api/analyze` endpoint with Gemini primary and Grok fallback (M001/Stage 1)
- **CV pipeline** — Hybrid CV pipeline with OpenCV.js WASM on Workers, contour detection, preprocessing, confidence scoring (M002/Stage 2)
- **Confidence calibration** — implausible_ratio eliminated (108→8 misses), ratio clamp + Sobel edge preference, tiered confidence scoring (M003)
- **Contour detection** — Adaptive threshold, heuristic scoring, 40% edge-case detection baseline (M003)
- **Worker runtime compatibility** — Pure-JS decoders replacing `sharp`, Workers-deployable pipeline (M003)
- **Admin API** — List analyses, patch corrections, manual upload endpoints with Bearer token auth (M002)
- **Supabase storage** — Image upload to storage bucket, CRUD on analyses table (M002)
- **Eval runner** — CV pipeline evaluation with `pnpm eval:cv` (M002)
- **Web scan flow** — Mock QR → camera scan → result display (Stage 1)
- **Admin shell** — Basic admin route component (Stage 1)

### Active

**Current Milestone: v1.0 Production Readiness**

- [ ] Train real regression model (ONNX) — target MAE < ±50ml
- [ ] Improve heuristic scoring to reduce empty→full and full→empty confusion
- [ ] Build full admin review/correction UI
- [ ] Build analytics dashboard (scan volume, accuracy metrics, failure rates)
- [ ] CI/CD pipeline for automated deployment
- [ ] Error monitoring and alerting
- [ ] Production wrangler configuration
- [ ] Production domain setup
- [ ] Data persistence hardening

### Out of Scope

- Mobile native apps — Web-first, PWA later
- Multi-language support beyond current i18n — Deferred
- Auto-capture (scan-on-sight without manual trigger) — Deferred
- 870-image full dataset training — Offline session

## Context

Previous milestones under older GSD system:
- **M001**: Stage 1 LLM-only — Failed (MAE 442ml)
- **M002**: Computer Vision Pipeline — Complete. Hybrid CV infrastructure built, Worker endpoint active, eval runner created
- **M003**: Pipeline Hardening — Partial. Confidence calibration (8x improvement), contour detection improvements, Worker runtime compatibility

Phase 09 (confidence calibration) has partial implementation from M003 that should be carried forward.

## Constraints

- **Tech Stack**: Cloudflare Workers, Hono, React/Vite/Tailwind, Supabase, OpenCV.js WASM, ONNX
- **LLM Dependencies**: Gemini API primary, Grok fallback, OpenRouter optional
- **Deployment**: Cloudflare Workers with Static Assets
- **Worker Runtime**: No Node.js native modules; pure-JS/WASM only

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hybrid CV + LLM pipeline | LLM-only failed (MAE 442ml); CV adds structured measurement | ✓ Good |
| OpenCV.js WASM on Workers | Avoids native modules; enables CV in Workers runtime | ✓ Good |
| Supabase for persistence | Serverless Postgres + storage, works with Workers | ⚠️ Revisit |
| Heuristic + regression model | Two-stage approach: heuristics now, train regression later | ⚠️ Revisit |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-15 after M004 milestone init*
