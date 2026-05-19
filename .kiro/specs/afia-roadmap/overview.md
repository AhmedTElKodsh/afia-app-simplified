# Afia Oil Level Scanner - Roadmap Overview

## Purpose

This roadmap is the canonical stage taxonomy for the Afia Oil Level Scanner. It organizes the project by analysis strategy:

- **Stage 1: API-only product validation** - use LLM APIs for all oil-level analysis while proving the workflow and building the correction dataset.
- **Stage 2: Hybrid local model development** - introduce a lightweight browser/mobile local model while keeping LLM APIs as fallback, evaluator, and dataset enhancer.
- **Stage 3: Local-first/local-only prelaunch** - move normal user scans toward local inference only, with APIs removed from the user path or retained only for internal QA/admin workflows.

The existing eval-only Stage 1 plan is now treated as **Stage 1.0**, the first level inside the broader API-only Stage 1.

## Guiding Principles

- Keep **1.5L** as the hero bottle until the scan, analysis, correction, and dataset loop is stable.
- Use **2.5L** mock QR/product identity only for architecture readiness until 1.5L proves the full loop.
- Keep a stable scan result contract across stages: product size, remaining ml, consumed ml, red-line position, confidence, warnings, provider/model metadata, and correction fields.
- Treat bad captures as first-class outcomes: reject, flag, or route them to fallback instead of silently trusting low-quality predictions.
- Advance stages only when the prior stage has measurable evidence, not just working screens.

## Stage Map

| Stage | Strategy | Primary Question | Main Output |
| --- | --- | --- | --- |
| Stage 1 | LLM/API-only | Can API analysis power a usable workflow and produce a training dataset? | Working API-driven workflow plus corrected dataset |
| Stage 2 | Hybrid local + API | Can a lightweight local model handle common 1.5L scans with API fallback? | Local model baseline, hybrid runtime, active learning loop |
| Stage 3 | Local-first/local-only | Can the product launch with local inference as the normal user path? | Hardened local path, model/version gates, launch readiness |

## Document Set

- `stage-1-api-only.md` - all API-only levels, including the current eval-only spike as Stage 1.0.
- `stage-2-hybrid-local-model.md` - dataset, local model, fallback, and active-learning plan.
- `stage-3-local-only-prelaunch.md` - local-first hardening and launch gates.
- `metrics-and-gates.md` - shared accuracy, quality, and progression gates.

