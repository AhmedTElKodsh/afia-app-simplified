---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T02: Fix manifest paths

Ensure all imagePath values in worker/test/fixtures/dev/probe-manifest.json are relative to the project root for portability.

## Inputs

- `worker/test/fixtures/dev/probe-manifest.json`

## Expected Output

- `Updated worker/test/fixtures/dev/probe-manifest.json with relative paths`

## Verification

Check the file content for relative paths.
