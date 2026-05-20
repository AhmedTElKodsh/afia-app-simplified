# Design Document: Afia Oil Level Scanner - Stage 1

## Overview

The Afia Oil Level Scanner Stage 1 is a Cloudflare-deployed web application that enables consumers to scan product QR/barcode links, preserve 1.5L or 2.5L bottle identity, capture front-side 1.5L photos using their phone cameras with functional outline guidance, and receive API-analyzed oil level measurements. The system uses a rotation pool of Gemini API keys with Grok fallback for image analysis, and persists all useful data to Supabase for admin review and future model training.

Stage 1 is still API-first. Functional guidance, client-side quality checks, and auto-capture improve the capture input, but they do not make CV/ONNX/local inference the primary production measurement path.

## Architecture Style

- **Monorepo**: Single pnpm workspace with clear separation of concerns
- **Serverless**: Cloudflare Workers for API and static asset serving
- **SPA**: React-based single-page application with client-side routing
- **Persistence**: Supabase (PostgreSQL + Storage) for analyses and images

## Design Decisions

### Decision 1: Supabase Integration in Stage 1

**Chosen**: Supabase for database and image storage

**Rationale**:
- Enables immediate data collection for training local models (Stage 2)
- Allows admin refinement loop from the start
- Provides a source of truth for ground truth data ingestion

### Decision 2: Multi-Key Gemini Rotation

**Chosen**: Round-robin rotation pool for Gemini API keys

**Rationale**:
- Increases quota and resilience
- Avoids rate limiting during peak usage

### Decision 3: UI Layout - Slider on Left

**Chosen**: Vertical slider positioned to the left of the bottle image

**Rationale**:
- Better ergonomic accessibility for thumb control
- Avoids overlapping with critical image details or other buttons

### Decision 4: Functional Outline With Manual Fallback

**Chosen**: Use a functional 1.5L outline that gives distance, alignment, and angle guidance, turns red/orange/green, and auto-captures after a stable green lock.

**Rationale**:
- Reduces bad captures before expensive API analysis
- Keeps the requested hands-light phone flow possible on Android and iOS browsers
- Preserves manual capture so the prototype remains usable when browser camera behavior or local frame analysis is unreliable

### Decision 5: Persistence Before Dataset Claims

**Chosen**: Treat Supabase image and analysis persistence as part of the Stage 1 product gate.

**Rationale**:
- M006 and later model work require durable, reviewable records
- A working result screen without persisted image/result/correction data cannot train or validate the local model
- Live Cloudflare/Supabase proof is required before moving to dataset/model milestones

## Data Models

### Supabase Table: `analyses`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary Key |
| `created_at` | `timestamptz` | Timestamp |
| `bottle_size` | `text` | "1.5L" |
| `image_url` | `text` | URL to Supabase Storage |
| `remaining_ml` | `integer` | Detected remaining oil |
| `consumed_ml` | `integer` | Detected consumed oil |
| `red_line_y_ratio` | `float` | Y position of liquid surface |
| `confidence` | `float` | LLM confidence |
| `provider` | `text` | "gemini" or "grok" |
| `raw_model_text` | `text` | Raw JSON from LLM |
| `quality_flags` | `jsonb` | Capture/model quality warnings |
| `correction_status` | `text` | Review state for label readiness |
| `admin_flag` | `text` | "too_big", "too_small", "manual" |
| `admin_corrected_ml` | `integer` | Corrected remaining oil |
| `admin_note` | `text` | Admin notes |
| `label_source` | `text` | API estimate, user correction, admin correction, or manual ground truth |

## Components

### 1. Oil Slider (Web)
- Vertical range input.
- Snaps to 55ml increments.
- Positioned on the left side of the bottle image.

### 2. Cup Counter (Web)
- Positioned below the slider.
- Visual cup filling in quarters.
- Text display (e.g., "1 1/2 Cups").

### 3. Admin Review Queue (Web)
- List of analyses.
- Form to mark inaccuracies and enter corrections.
- Manual image upload for training data.

### 4. Capture Framing Guide (Web)
- 1.5L outline over the live preview.
- Guide is intentionally smaller than the camera preview so the user leaves visible space around the full bottle.
- Guide remains upright; the bottle itself should not be shown leaning sideways.
- Instruction copy tells the user to aim the phone slightly downward from hand height toward the bottle on a lower table surface.
- The outline must not fill the full preview; the smaller bottle appearance comes from distance and downward phone pitch.
- Local frame sampling estimates whether the silhouette is too small, too large, off-center, or vertically misaligned.
- The guide exposes red/orange/green state and only auto-captures after stable green lock.
- Manual capture remains visible and usable.

### 5. Capture Quality Gate (Web/API)
- Client checks reject very low resolution, very dark, overexposed, or very blurry/flat captures when frame data is available.
- API/model warnings remain part of the result contract for blur, glare, wrong side, partial bottle, poor framing, unsupported product, and uncertain label.
- Rejected and uncertain captures can remain diagnostic evidence, but they must not enter trusted training labels by default.

### 6. Dataset and Admin Loop
- User slider movement is local until the user explicitly accepts or submits a correction.
- User corrections, admin corrections, and manual uploads preserve original prediction, corrected value, label source, quality tags, and review status.
- Admin routes fail closed when the admin token is missing or invalid.
- Dataset export/query rules belong to the next dataset milestone and must prevent rejected or uncertain records from contaminating training.
