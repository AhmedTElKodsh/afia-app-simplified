/**
 * Central error code definitions for the Afia web client.
 *
 * Error codes follow the pattern: AREA_SPECIFIC_ERROR
 * Used by CaptureShell for error state persistence and
 * ResultShell for error code display.
 *
 * Per D-14: error state is persisted to sessionStorage
 * as { errors: Array<{code, description}>, tier, confidence, remainingMl }.
 *
 * @see CaptureShell.tsx — persists errors on analysis failure
 * @see ResultShell.tsx — reads and displays errors
 */

/** Application-wide error code constants */
export const ERROR_CODES = {
  /** Analysis pipeline failure (CV + LLM both failed) */
  ANALYSIS_FAILED: "ANALYSIS_FAILED",
  /** Network error during analysis request */
  NETWORK_ERROR: "NETWORK_ERROR",
  /** API returned an error status */
  API_ERROR: "API_ERROR",
  /** Camera capture failed */
  CAPTURE_FAILED: "CAPTURE_FAILED",
} as const;

/** Valid error code values */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** A single structured error entry persisted to sessionStorage */
export interface ErrorEntry {
  code: ErrorCode;
  description: string;
}

/**
 * Error result shape stored in sessionStorage when analysis fails (D-14).
 * This is read by ResultShell to render the fatal error card.
 */
export interface ErrorResult {
  errors: ErrorEntry[];
  /** "error" = both CV and LLM failed; "degraded" reserved for Phase 2+ */
  tier: "error" | "degraded";
  confidence: number;
  remainingMl: number | null;
}

/** Union type for stored analysis results — success or error */
export type StoredAnalysisResult =
  | { remainingMl: number; redLineYRatio: number }
  | ErrorResult;

/**
 * Type guard that narrows StoredAnalysisResult to ErrorResult.
 * Used by ResultShell to determine which view to render.
 */
export function isErrorResult(
  result: unknown,
): result is ErrorResult {
  return (
    typeof result === "object" &&
    result !== null &&
    "tier" in result &&
    (result as ErrorResult).tier === "error"
  );
}

/**
 * Read the support contact email from Vite env var with fallback.
 *
 * VITE_CONTACT_SUPPORT_EMAIL can be set in .env or CI env.
 * Defaults to support@afia.co if not configured.
 */
export function getSupportEmail(): string {
  return (
    (typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_CONTACT_SUPPORT_EMAIL) ||
    "support@afia.co"
  );
}
