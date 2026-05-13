---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T03: Run probe eval

Execute the eval:probe script and capture the output to verify the baseline accuracy.

## Inputs

- `worker/test/fixtures/dev/probe-manifest.json`

## Expected Output

- `Eval summary in stdout, JSONL record in runs/ directory`

## Verification

Check that a new .jsonl file was created in runs/ and the summary was printed.
