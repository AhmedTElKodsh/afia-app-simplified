# S01: S01

**Goal:** Establish a reliable baseline with the probe set.
**Demo:** Diagnostic report for 12 probe images.

## Must-Haves

- Eval runner completes 12-image probe set and outputs valid JSONL and summary.

## Proof Level

- This slice proves: verified runner output

## Integration Closure

No new integrations.

## Verification

- Rich diagnostics in eval runner.

## Tasks

- [x] **T01: Collected and configured API keys in worker/.env.** `est:5m`
  Collect Gemini API key(s) from the user and save to .env using secure_env_collect.
  - Files: `worker/.env`
  - Verify: Check that worker/.env exists and contains the keys.

- [x] **T02: Fix manifest paths** `est:10m`
  Ensure all imagePath values in worker/test/fixtures/dev/probe-manifest.json are relative to the project root for portability.
  - Files: `worker/test/fixtures/dev/probe-manifest.json`
  - Verify: Check the file content for relative paths.

- [x] **T03: Run probe eval** `est:15m`
  Execute the eval:probe script and capture the output to verify the baseline accuracy.
  - Files: `runs/*.jsonl`
  - Verify: Check that a new .jsonl file was created in runs/ and the summary was printed.

## Files Likely Touched

- worker/.env
- worker/test/fixtures/dev/probe-manifest.json
- runs/*.jsonl
