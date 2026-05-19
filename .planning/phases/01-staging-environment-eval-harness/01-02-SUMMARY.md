---
phase: 01-staging-environment-eval-harness
plan: 02
subsystem: Web Frontend — Fallback UX
tags: [fallback-ui, error-handling, session-storage, ux]
requires: [01-01]
provides: [fallback-ux, error-card, degraded-view-reserved]
affects: [web-package]
tech-stack:
  added: [extracted-error-module]
  patterns: [sessionStorage-error-state, type-guard, error-code-constants, error-entry-type]
key-files:
  created:
    - web/src/errors.ts
  modified:
    - web/src/components/CaptureShell.tsx
    - web/src/components/ResultShell.tsx
decisions:
  - "Error state persisted in sessionStorage as structured object (D-14)"
  - "ResultShell branches on tier to render fatal error card (D-13)"
  - "Degraded view (tier: degraded) reserved for Phase 2+ when API returns partial results (D-12)"
  - "Error types extracted to web/src/errors.ts for central reuse"
  - "Error codes follow AREA_SPECIFIC_ERROR pattern in centralized constants"
  - "Contact support email configurable via VITE_CONTACT_SUPPORT_EMAIL env var"
metrics:
  duration: "~3 min (automation) + human checkpoint verification"
  completed_date: "2026-05-15"
---

# Phase 01 Plan 02: Fallback UX — Summary

Implemented graceful fallback UX when inference fails per D-12, D-13, D-14. CaptureShell persists structured error state to sessionStorage on analysis failure and redirects to /result. ResultShell reads the error state, uses a type guard to branch on `tier`, and renders a fatal error card with error description, monospace error code, Retry Scan button, and Contact Support link. No backend changes — all state flows through sessionStorage. Normal success path is byte-identical to prior behavior.

## Commits

| Hash     | Message                                                                 |
|----------|-------------------------------------------------------------------------|
| afb6e7d5 | feat(01-02): persist structured error state in CaptureShell on analysis failure |
| dbb0896b | feat(01-02): update ResultShell with fatal error card and degraded UX   |

## Created

- **`web/src/errors.ts`** (80 lines) — Central error module with `ERROR_CODES` constants, `ErrorEntry`/`ErrorResult` interfaces, `StoredAnalysisResult` union type, `isErrorResult` type guard, and `getSupportEmail` helper

## Modified

- **`web/src/components/CaptureShell.tsx`** — Updated `captureFrame` error handling to persist structured `{ errors: [{code, description}], tier: "error", confidence: 0, remainingMl: null }` via `sessionStorage.setItem(ANALYSIS_STORAGE_KEY, ...)` and navigate to `/result` on failure
- **`web/src/components/ResultShell.tsx`** — Updated `readStoredResult` to parse both normal `AnalysisResultContract` and error state; added `isErrorResult` type guard + tier branch in render path for fatal error card with error description(s), monospace error code, Retry Scan link to `/scan`, and Contact Support `mailto` link

## Verification

- `pnpm build` passes (tsc type-check + vite build) ✓
- `CaptureShell.tsx` persists `{ errors, tier }` sessionStorage on catch ✓
- `CaptureShell.tsx` uses `err instanceof Error` for safe message extraction ✓
- `CaptureShell.tsx` navigates to `/result` after failure ✓
- `ResultShell.tsx` has `isErrorResult` type guard and tier branch ✓
- `ResultShell.tsx` renders fatal error card with description, error code, Retry Scan, Contact Support ✓
- Normal result path unchanged (byte-identical to prior behavior) ✓
- Error state JSON round-trips through JSON.parse/stringify without data loss ✓
- `ERROR_CODES.ANALYSIS_FAILED` used in capture error state ✓
- `getSupportEmail()` from `errors.ts` provides mailto target ✓

## Deviations from Plan

### Rule 2 — Extracted error types to shared module for reusability

The plan specified inline `ErrorResult` interface and type guard in `ResultShell.tsx`. During implementation, types were extracted to a dedicated `web/src/errors.ts` module to avoid duplication between CaptureShell and ResultShell, and to provide a single source of truth for error codes and types across the frontend.

**Changes:**
- Created `web/src/errors.ts` with `ERROR_CODES` constants, `ErrorEntry`/`ErrorResult` interfaces, `StoredAnalysisResult` union type, `isErrorResult` type guard, and `getSupportEmail` helper
- Imported shared types from `../errors` in both CaptureShell.tsx and ResultShell.tsx

**Alignment:** This improves maintainability and follows existing project patterns (shared types in dedicated modules). Does not alter plan decisions D-12, D-13, D-14.

### Rule 2 — Added configurable support email via VITE_CONTACT_SUPPORT_EMAIL

The plan specified a hardcoded `support@afia.co` mailto. The implementation added `getSupportEmail()` in `errors.ts` that reads from `import.meta.env.VITE_CONTACT_SUPPORT_EMAIL` with a fallback to `support@afia.co`. This allows operators to configure the contact address without code changes.

**Alignment:** Enhancement consistent with D-13 (contact support link). No plan decisions altered.

## Auth Gates

None encountered. All operations were file modification within the repo.

## Known Stubs

- Degraded view (tier: "degraded") is not rendered — reserved for Phase 2+ when the API returns partial results. A comment in ResultShell documents this.

## Self-Check: PASSED

- [x] `web/src/errors.ts` exists with error types, constants, and utilities
- [x] `web/src/components/CaptureShell.tsx` persists structured error state on analysis failure
- [x] `web/src/components/ResultShell.tsx` branches on tier to render fatal error card
- [x] Fatal error card includes description(s), error code, Retry Scan, Contact Support
- [x] `pnpm build` passes
- [x] Commit afb6e7d5 verified in git log
- [x] Commit dbb0896b verified in git log
