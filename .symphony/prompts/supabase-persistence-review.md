# Supabase Persistence Review Prompt

Review Supabase/admin changes for Afia Stage 1 dataset quality.

The data model must protect future training labels:

- Every useful capture has product size and image reference.
- Original normalized analysis is preserved.
- Raw provider metadata is stored only when safe and useful.
- Prompt/model version and provider are recorded.
- Admin corrections preserve original value, corrected value, reason code, status, reviewer identity if available, and timestamps.
- Manual uploads include product metadata and ground-truth remaining ml.
- Reject/approve flows do not destroy evidence.

Flag any change that overwrites original model output, stores ambiguous labels, loses correction provenance, or allows unsupported product sizes into the 1.5L training path.
