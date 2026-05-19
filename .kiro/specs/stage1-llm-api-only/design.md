# Design Document: Afia Oil Level Scanner - Stage 1

## Overview

The Afia Oil Level Scanner Stage 1 is a Cloudflare-deployed web application that enables consumers to scan QR codes on 1.5L Afia cooking oil bottles, capture photos using their phone cameras with visual guidance, and receive LLM-analyzed oil level measurements. The system uses a rotation pool of Gemini API keys with Grok fallback for image analysis, and persists all data to Supabase for admin review and future model training.

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
| `admin_flag` | `text` | "too_big", "too_small", "manual" |
| `admin_corrected_ml` | `integer` | Corrected remaining oil |
| `admin_note` | `text` | Admin notes |

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
- Static 1.5L SVG outline over the live preview.
- Guide is intentionally smaller than the camera preview so the user leaves visible space around the full bottle.
- Guide remains upright; the bottle itself should not be shown leaning sideways.
- Instruction copy tells the user to aim the phone slightly downward from hand height toward the bottle on a lower table surface.
- The outline must not fill the full preview; the smaller bottle appearance comes from distance and downward phone pitch.
