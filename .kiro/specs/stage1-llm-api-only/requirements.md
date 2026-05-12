# Requirements Document

## Introduction

The Afia Oil Level Scanner Stage 1 is a Cloudflare-deployed web application that enables consumers to scan a QR code on a 1.5L Afia cooking oil bottle, capture a photo using their phone camera with a static front-side outline guide, and receive an LLM-analyzed oil level showing consumed and remaining milliliters with a visual red line indicator. Stage 1 focuses on validating the LLM pipeline using Gemini API keys (multi-key rotation) with Grok fallback, and persists all captures and results to a Supabase database. This enables an Admin dashboard for result revision, manual corrections, and image ingestion for future model training.

## Glossary

- **System**: The Afia Oil Level Scanner web application
- **Worker**: The Cloudflare Worker serving both API and SPA via Static Assets
- **SPA**: Single Page Application (React + Vite frontend)
- **LLM**: Large Language Model (Gemini or Grok) used for image analysis
- **Supabase**: Backend-as-a-Service used for database (PostgreSQL) and storage (images)
- **Orchestrator**: The component that manages LLM API calls with rotation and fallback logic
- **Consumer**: End user scanning and analyzing their oil bottle
- **Admin**: User with admin token accessing QR generation and review queue
- **QR_Code**: QR code printed on bottle that encodes the scan URL with bottle size
- **Bottle_Size**: Either "1.5L" or "2.5L" (Stage 1 only supports 1.5L)
- **Analysis_Result**: JSON object containing remainingMl, consumedMl, redLineYRatio, confidence, provider
- **Red_Line**: Visual indicator overlaid on captured image showing detected oil level
- **Outline_Guide**: Static SVG overlay showing bottle silhouette for alignment during capture
- **Cup_Counter**: Visual display converting milliliters to cooking cups (220ml per cup, 55ml per quarter)
- **Oil_Slider**: User-controlled vertical slider on the left of the bottle to adjust the remaining oil level manually.

## Requirements

### Requirement 1: QR Code Landing and Size Routing

**User Story:** As a consumer, I want to scan a QR code on my bottle and be routed to the appropriate capture flow, so that I can analyze my specific bottle size.

#### Acceptance Criteria

1. WHEN a QR code with size parameter "1.5L" is scanned, THE System SHALL redirect to the capture page with size=1.5L
2. WHEN a QR code with size parameter "2.5L" is scanned, THE System SHALL display a message indicating that size is not supported in Stage 1
3. WHEN a QR code with missing or invalid size parameter is scanned, THE System SHALL display an error message indicating unknown bottle size
4. THE System SHALL preserve the size parameter throughout the capture and analysis flow

### Requirement 2: Camera Capture with Bottle Outline Guide

**User Story:** As a consumer, I want to capture a photo of my bottle with visual guidance, so that the LLM can accurately analyze the oil level.

#### Acceptance Criteria

1. WHEN the capture page loads, THE System SHALL request camera access with environment-facing mode preference
2. WHILE camera access is granted, THE System SHALL display live video preview with playsinline attribute for iOS compatibility
3. THE System SHALL overlay a static SVG bottle outline on the video preview for alignment guidance.
4. THE System SHALL ensure the outline is positioned to not overshadow the camera button or upper instructions.
5. THE System SHALL visually adjust upper instructions to not overlap with floating language and theme buttons.
6. THE System SHALL present the guide at a reduced size with clear surrounding margins so consumers stand back instead of filling the screen with the bottle.
7. THE System SHALL keep the bottle guide upright while instructing the consumer to angle the phone slightly downward from hand height toward a lower table surface.
8. WHEN the consumer taps the capture button, THE System SHALL capture the current video frame as JPEG with 0.9 quality
9. WHEN capture is complete, THE System SHALL navigate to the result page with the captured image as base64 data URL
10. IF camera access is denied, THEN THE System SHALL display an error message explaining camera permission is required

### Requirement 3: LLM Image Analysis with Gemini and Grok Fallback

**User Story:** As a consumer, I want my bottle photo analyzed by an LLM, so that I can see how much oil remains.

#### Acceptance Criteria

1. WHEN the System receives an analysis request with bottleSize and imageBase64, THE Orchestrator SHALL attempt to call Gemini API with the image and bottle reference prompt
2. THE Orchestrator SHALL use a rotation pool of multiple Gemini API keys to avoid rate limits.
3. IF Gemini API call fails, THEN THE Orchestrator SHALL retry once after 1 second delay
4. IF both Gemini attempts fail, THEN THE Orchestrator SHALL fallback to Grok API with the same image and prompt
5. WHEN either LLM returns a response, THE Parser SHALL extract JSON from the response text
6. THE Parser SHALL validate the response contains remainingMl, consumedMl, redLineYRatio, and confidence fields
7. THE Analysis_Result SHALL include the provider field indicating which LLM was used ("gemini" or "grok")

### Requirement 4: Persistence to Supabase

**User Story:** As a developer, I want all captures and analysis results persisted, so that they can be reviewed and used for future model training.

#### Acceptance Criteria

1. THE System SHALL upload every captured bottle image to Supabase Storage.
2. THE System SHALL save the Analysis_Result, image URL, and metadata to the Supabase `analyses` table.
3. THE record SHALL include a unique ID returned to the SPA for subsequent updates (e.g., admin corrections).

### Requirement 5: Admin Dashboard and Result Revision

**User Story:** As an admin, I want to review analysis results and correct them if necessary, so that we build a high-quality dataset.

#### Acceptance Criteria

1. THE Admin Dashboard SHALL list all persisted analysis records with their images and detected levels.
2. THE Admin SHALL be able to mark a result as "not accurate" (too big or too small).
3. THE Admin SHALL be able to manually enter the correct oil level or trigger an LLM fallback re-analysis.
4. THE Admin SHALL be able to upload a bottle image along with metadata and ground truth oil level directly to the dashboard.

### Requirement 6: Result Display with Red Line and Slider

**User Story:** As a consumer, I want to see my captured photo with a visual indicator and a slider to adjust the level, so that I can get the most accurate cup count.

#### Acceptance Criteria

1. WHEN analysis completes successfully, THE System SHALL display the captured image with a red horizontal line positioned at redLineYRatio.
2. THE System SHALL display an Oil_Slider on the LEFT side of the bottle image.
3. THE Oil_Slider SHALL initialize at the detected red line position.
4. THE Oil_Slider SHALL move in 55ml increments (1/4 tea cup).
5. WHEN the slider is moved, THE System SHALL update the Cup_Counter display below the slider.

### Requirement 7: Cup Counter Visualization

**User Story:** As a consumer, I want to see a visual representation of cups filled based on my oil usage, so that I can easily measure for cooking.

#### Acceptance Criteria

1. THE Cup_Counter SHALL be displayed BELOW the Oil_Slider.
2. THE Cup_Counter SHALL display a static cup shape that fills visually in quarters (1/4, 1/2, 3/4, Full).
3. THE Cup_Counter SHALL display the numerical count of cups (e.g., "1 1/4 Cups").
4. EACH 55ml movement on the slider SHALL fill 1/4 of a cup visualization.

### Requirement 18: Stage 1 Scope Boundaries

**User Story:** As a product owner, I want clear boundaries for Stage 1, so that the team focuses on the essential core workflow.

#### Acceptance Criteria

1. THE System SHALL support 1.5L bottles ONLY.
2. THE System SHALL use manual capture initially (no auto-lock/auto-take).
3. THE System SHALL NOT support local on-device model inference in Stage 1.
4. THE System SHALL implement Supabase persistence and Admin revision as core Stage 1 features.
