---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T02: Model Version Tracking

Define model version tracking schema and add validation tests.

## Inputs

- None specified.

## Expected Output

- `worker/src/eval/model-version.ts`
- `worker/test/model-version.test.ts`

## Verification

pnpm --filter worker test -- model-version
