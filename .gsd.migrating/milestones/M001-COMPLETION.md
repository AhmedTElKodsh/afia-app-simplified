# M001 Milestone Audit — Stage 1 Remediation & Accuracy Boost

**Status:** gaps_found
**Completed:** 2026-05-13
**Slices:** 4 planned, 3 complete, 1 blocked

## Goal vs Achievement

**Goal:** Reduce error to ±50ml on 12-image probe set by refining LLM prompts, expanding few-shot anchors, and implementing reasoning-first visual detection.

**Result:** FAILED. MAE worsened from 390ml (baseline) to 442ml (post-remediation).

## Slice Summary

| Slice | Status | Finding |
|-------|--------|---------|
| S01: Baseline | ✅ Complete | Established baseline MAE 390ml (0% exact accuracy) |
| S02: Few-Shot Expansion | ✅ Complete | 12 anchors made it WORSE (MAE 427ml) |
| S04: Golden Set + CoT | ✅ Complete | 5 anchors + CoT made it WORSE (MAE 442ml) |
| S03: Full Dev Validation | ⛔ Blocked | No viable strategy to validate |

## Requirements Coverage

| ID | Requirement | Status |
|----|-------------|--------|
| R001 | Accurate oil level estimation | ❌ Not achieved |
| R002 | Admin correction interface | ○ Not started |

## Root Cause

LLM vision APIs (Gemini 2.5 Flash, gpt-4o-mini, Llama 3.2 11B Vision) fundamentally cannot perform pixel-level volumetric regression. All models anchor to ~1400ml regardless of prompt strategy. CoT instruction targets the text decoder but cannot influence the separate vision encoder trunk.

## Verdict

**Prompt engineering is a dead end for this problem.** Stage 1 (API-only LLM) cannot achieve the ±50ml target. The evidence is consistent across 3 model families and 4 controlled experiments. A fundamentally different approach is required (OpenCV pipeline, local model with regression head, or mechanical indicator).

## Recommendation

Document the capability gap and pivot. Options:
1. OpenCV contour detection + deterministic measurement (LLM for validation only)
2. Lightweight regression head on vision encoder CLS token (~100 labeled images)
3. Change the measurement approach to mechanical/visual reference markers
