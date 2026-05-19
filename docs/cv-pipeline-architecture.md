# CV Pipeline Architecture

## Pipeline Stages

```
Input Image
    │
    ▼
┌─────────────┐
│ Validate    │ ← Bottle size check (1.5L only)
└──────┬──────┘
       │ (pass)
       ▼
┌─────────────┐
│ Preprocess  │ ← Grayscale → Gaussian blur → CLAHE
└──────┬──────┘
       │ (pass)
       ▼
┌─────────────┐
│ Contour     │ ← Canny edges → findContours → meniscus
└──────┬──────┘
       │ (found?) ─── No ──► Error: CONTOUR_NOT_FOUND
       │ Yes
       ▼
┌─────────────┐
│ Confidence  │ ← Edge clarity + ratio bounds + contour count
└──────┬──────┘
       │
       ▼
    Decision Gate
        │
        ├── High (≥0.7) ──► Direct output
        ├── Medium (≥0.3) ──► Run regression model
        └── Low (<0.3) ──► LLM validation
```

## Latency Budget

| Stage | Budget | Notes |
|-------|--------|-------|
| Preprocess | 500ms | WASM processing |
| Contour | 500ms | WASM processing |
| Confidence | 10ms | Synchronous score calc |
| Regression (if needed) | 500ms | ONNX/TFJS inference |
| LLM (if needed) | 2000ms | API call with timeout |
| **Total (worst case)** | **~3.5s** | All stages fire |

## Error Handling

| Code | Stage | Recoverable | Action |
|------|-------|-------------|--------|
| CONTOUR_NOT_FOUND | contour | No | Return error with diagnostic |
| IMPLAUSIBLE_RATIO | contour | No | Return error with ratio |
| PERSPECTIVE_FAILED | preprocess | Yes | Retry with fallback preset |
| REGRESSION_FAILED | regression | Yes | Use CV output directly |
| LLM_TIMEOUT | llm | Yes | Proceed without LLM |
| UNSUPPORTED_BOTTLE | validate | No | Return unsupported msg |
| INTERNAL_ERROR | pipeline | No | Return 500 |

## Response Contract

```json
{
  "remainingMl": number | null,
  "confidence": number,
  "confidenceTier": "high" | "medium" | "low",
  "warnings": string[],
  "diagnostics": {
    "contourFound": boolean,
    "meniscusY": number | null,
    "edgeStrength": number,
    "stages": string[]
  },
  "errors": [
    { "stage": "contour", "code": "CONTOUR_NOT_FOUND", "message": "...", "recoverable": false }
  ]
}
```
