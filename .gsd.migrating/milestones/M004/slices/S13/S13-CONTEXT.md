# S13: Integration + Error Tests — Context

**Gathered:** 2026-05-13
**Status:** Ready for planning
**Closes:** 4 missing gaps from validation audit

## Problem
Error path testing is nonexistent. The cv-analyze.test.ts file exists but has never been run. No test validates the PipelineError contract shape.

## Key Files Under Test
- worker/src/cv/errors.ts — error factory functions
- worker/src/routes/cv-analyze.ts — Hono route with error responses
- worker/test/cv-analyze.test.ts — existing integration tests (untested)
