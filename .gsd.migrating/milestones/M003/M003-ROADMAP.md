# M003: ONNX Integration & Fusion (Stage 1.5)

**Vision:** Achieve ±45ml accuracy by fusing heuristic contour detection with a custom-trained ONNX regression model and optional LLM verification.

## Slices

- [ ] **S09: S09** `risk:medium` `depends:[]`
  > After this: Regression model loaded and bench-tested in CV pipeline.

- [ ] **S10: Multi-Signal Fusion Scorer** `risk:high` `depends:[S09]`
  > After this: Fusion result combining Heuristic + ONNX + LLM signals.

- [ ] **S11: Stage 1.5 Validation & Sign-off** `risk:medium` `depends:[S10]`
  > After this: Final sign-off report for Stage 1.5 readiness.

## Boundary Map

Not provided.
