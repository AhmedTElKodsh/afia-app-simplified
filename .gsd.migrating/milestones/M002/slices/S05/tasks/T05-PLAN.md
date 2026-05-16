---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T05: Failure detection and error handling

Handle zero contours, implausible ratios, perspective failures. Return diagnostic info per stage.

## Inputs

- Pipeline stage outputs

## Expected Output

- worker/src/cv/errors.ts with structured error types

## Verification

Each failure mode returns structured error with stage identification.
