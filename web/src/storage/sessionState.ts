/**
 * Consolidated session state envelope.
 *
 * Replaces 4 parallel sessionStorage keys (afia.capture, afia.analysis,
 * afia.captureSource, afia.errorContext) with a single versioned envelope
 * to eliminate race conditions and partial-write risk.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CaptureState {
  captureSource: string;
  captureBlob: string;
  capturedAt: string;
}

export interface AnalysisState {
  remainingMl: number | null;
  redLineYRatio?: number;
  tier: "success" | "error" | "degraded";
  errors?: Array<{ code: string; description: string }>;
  confidence: number;
  consumedMl?: number;
  warnings?: string[];
  provider?: string;
  rawMetadata?: Record<string, unknown>;
}

export interface AfiaSessionState {
  version: number;
  capture?: CaptureState;
  analysis?: AnalysisState;
  errorContext?: Record<string, string>;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Storage key & version
// ---------------------------------------------------------------------------

const STORAGE_KEY = "afia.state";
const CURRENT_VERSION = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Merge partial state into the existing envelope and persist.
 */
export function writeState(state: Partial<AfiaSessionState>): void {
  try {
    const existing = readState() ?? ({} as AfiaSessionState);
    const merged: AfiaSessionState = {
      ...existing,
      ...state,
      version: CURRENT_VERSION,
      updatedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // sessionStorage may be full or unavailable; fail silently
  }
}

/**
 * Read the full session envelope, or null if none exists / corrupt.
 */
export function readState(): AfiaSessionState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AfiaSessionState;
  } catch {
    return null;
  }
}

/**
 * Remove the entire session envelope from storage.
 */
export function clearState(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

const OLD_KEYS = ["afia.capture", "afia.analysis", "afia.captureSource", "afia.errorContext"] as const;

/**
 * Read old 4-key sessionStorage layout and migrate to single envelope.
 *
 * Call once on app boot (idempotent — skips if envelope already exists
 * or no old keys found).
 *
 * @returns true if data was migrated, false if nothing to do.
 */
export function migrateFromOldKeys(): boolean {
  try {
    // Already migrated — envelope exists
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing) return false;

    const capture = sessionStorage.getItem("afia.capture");
    const analysis = sessionStorage.getItem("afia.analysis");

    if (!capture && !analysis) return false; // nothing to migrate

    const state: AfiaSessionState = {
      version: CURRENT_VERSION,
      updatedAt: new Date().toISOString(),
    };

    if (capture) {
      const source = sessionStorage.getItem("afia.captureSource") ?? "camera";
      state.capture = {
        captureSource: source,
        captureBlob: capture,
        capturedAt: new Date().toISOString(),
      };
    }

    if (analysis) {
      try {
        const parsed = JSON.parse(analysis);
        const tier = parsed.tier === "error" ? "error" : "success";
        state.analysis = {
          remainingMl: parsed.remainingMl ?? null,
          tier,
          confidence: parsed.confidence ?? 0,
          redLineYRatio: parsed.redLineYRatio,
          errors: parsed.errors,
          consumedMl: parsed.consumedMl,
          warnings: parsed.warnings,
          provider: parsed.provider,
          rawMetadata: parsed.rawMetadata,
        };
      } catch {
        // skip corrupt analysis
      }
    }

    const errorCtxRaw = sessionStorage.getItem("afia.errorContext");
    if (errorCtxRaw) {
      try {
        state.errorContext = JSON.parse(errorCtxRaw);
      } catch {
        // skip corrupt context
      }
    }

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    // Clean up old keys
    for (const key of OLD_KEYS) {
      sessionStorage.removeItem(key);
    }

    return true;
  } catch {
    return false;
  }
}
