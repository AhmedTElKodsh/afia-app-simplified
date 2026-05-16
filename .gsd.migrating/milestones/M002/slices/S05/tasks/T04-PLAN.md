---
estimated_steps: 2
estimated_files: 1
skills_used: []
---

# T04: Confidence scoring and gating

Derive confidence from edge clarity, contour aspect ratio, contrast. Define threshold tiers.

## Inputs

- Contour detection output from T03

## Expected Output

- worker/src/cv/confidence.ts
- docs/cv-confidence-tiers.md

## Verification

Confidence scores differentiate pristine vs ambiguous cases.
