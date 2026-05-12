# Implementation Plan: Afia Oil Level Scanner - Stage 1 (Stripped Core)

## Tasks

### Phase 1: Foundation and Shared Infrastructure
- [x] 1. Set up monorepo structure and shared types
- [x] 2. Update `packages/shared` with Supabase-ready schemas and refined bottle constants.

### Phase 2: Worker API - Supabase & LLM
- [x] 3. Implement Supabase client helper in `worker/src/storage/supabase.ts`.
- [x] 4. Implement Gemini multi-key rotation logic in `worker/src/llm/rotation.ts`.
- [x] 5. Implement `POST /api/analyze` in `worker/src/routes/analyze.ts`:
  - Call Gemini (rotation) -> Fallback Grok.
  - Upload image to Supabase Storage.
  - Insert record into Supabase `analyses` table.
- [x] 6. Implement Admin API endpoints in `worker/src/routes/admin.ts`:
  - `GET /api/admin/analyses`: List records.
  - `PATCH /api/admin/analyses/:id`: Update corrections.
  - `POST /api/admin/upload`: Manual ingestion.

### Phase 3: Web App - Capture & Results
- [x] 7. Implement `CameraCapture` with static SVG outline and manual button.
  - Adjust outline position to avoid camera button.
  - Visual padding for instructions/floating buttons.
  - Size the guide so the bottle does not fill the preview; users should step back and leave margin around the full bottle.
  - Keep the bottle guide upright; communicate that the phone is angled downward toward a bottle sitting lower on a table.
- [x] 8. Implement `Result` page:
  - Red line overlay on image.
  - Vertical Oil Slider on the LEFT.
  - Cup Counter BELOW the slider.
- [x] 9. Implement `Admin` pages:
  - `ReviewQueue`: List and filter captures.
  - `ManualUpload`: Form for data ingestion.

### Phase 4: Integration
- [x] 10. End-to-end test: Scan -> Capture -> Analyze -> Persist -> Admin Review.
  - `web/test/stage1-client-flow.test.tsx` verifies mock QR -> camera capture -> `/api/analyze` response -> result screen -> admin review correction.
  - `worker/test/stage1-flow.test.ts` verifies `/api/analyze` -> persisted analysis record -> admin list -> admin correction.
  - Live Worker/Supabase/Gemini proof still requires a configured Worker runtime with deployment secrets.
