import { Link, useSearchParams } from "react-router-dom";
import { BOTTLE_1_5L, DEFAULT_BOTTLE_SIZE, ML_PER_CUP_QUARTER } from "@afia/shared";
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  isErrorResult,
  getSupportEmail,
  type ErrorResult,
  type StoredAnalysisResult,
} from "../errors";
import { readState } from "../storage/sessionState";
const DEFAULT_REMAINING_ML = 770;
const SLIDER_MAX_ML = Math.floor(BOTTLE_1_5L.capacityMl / ML_PER_CUP_QUARTER) * ML_PER_CUP_QUARTER;
const DEFAULT_RED_LINE_Y_RATIO = mlToYRatio(snapMl(DEFAULT_REMAINING_ML));

export function ResultShell() {
  const [params] = useSearchParams();
  const size = params.get("size") ?? DEFAULT_BOTTLE_SIZE;
  const isRetry = params.get("retry") === "true";
  const capturedImage = readCapturedImage();
  const initialResult = readStoredResult();
  const errorContext = readErrorContext();
  const modelRemainingMl = useMemo(
    () => snapMl(initialResult != null && !isErrorResult(initialResult) ? initialResult.remainingMl : DEFAULT_REMAINING_ML),
    [initialResult],
  );
  const detectedRedLineYRatio = !isErrorResult(initialResult)
    ? initialResult?.redLineYRatio ?? DEFAULT_RED_LINE_Y_RATIO
    : DEFAULT_RED_LINE_Y_RATIO;
  const [remainingMl, setRemainingMl] = useState(modelRemainingMl);
  const thumbYRatio = useMemo(
    () => (remainingMl === modelRemainingMl ? detectedRedLineYRatio : mlToYRatio(remainingMl)),
    [detectedRedLineYRatio, modelRemainingMl, remainingMl],
  );
  const consumedMl = BOTTLE_1_5L.capacityMl - remainingMl;
  const cupDisplay = formatCups(consumedMl);

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-16 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-lg flex-col justify-center gap-5">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-amber-300">Analysis</p>
          <h1 className="mt-3 text-4xl font-semibold">Afia {size}</h1>
        </div>

        {capturedImage && initialResult ? (
          isErrorResult(initialResult) ? (
            <>
              {/* Fatal error card (D-13): error description, error code, retry, contact support */}
              <div className="rounded-lg border border-red-400/50 bg-red-500/10 p-6 text-center">
                <p className="text-lg font-semibold text-red-300">Analysis Failed</p>
                <div className="mt-3 space-y-2 text-sm text-neutral-200">
                  {initialResult.errors.map((err, i) => (
                    <p key={i}>{err.description}</p>
                  ))}
                  {initialResult.errors.length > 0 && (
                    <p
                      className="mt-1 font-mono text-xs text-neutral-400"
                      aria-label={`Error code: ${initialResult.errors[0].code}`}
                    >
                      Error code: {initialResult.errors[0].code}
                    </p>
                  )}
                </div>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Link
                    className="rounded-md bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-500 transition-colors"
                    to={`/scan?size=${encodeURIComponent(size)}${isRetry ? "&retry=true" : ""}`}
                  >
                    Retry Scan
                  </Link>
                  <a
                    className="rounded-md border border-white/20 px-5 py-3 font-semibold text-white hover:bg-white/5 transition-colors"
                    href={buildMailtoHref(errorContext)}
                  >
                    Contact Support
                  </a>
                </div>
              </div>
              {/* Sally: show captured image below error card for context */}
              {capturedImage && (
                <div className="rounded-lg border border-white/15 bg-white/8 p-3">
                  <p className="mb-2 text-xs font-medium text-neutral-400 uppercase tracking-wider">
                    Captured Image
                  </p>
                  <img
                    src={capturedImage}
                    alt="Captured bottle that failed analysis"
                    className="block max-h-48 w-full rounded object-contain bg-black"
                  />
                </div>
              )}
            </>
          ) : (
            /* Normal result view (unchanged) */
            <div className="grid grid-cols-[86px_minmax(0,1fr)] items-start gap-4">
              <div className="flex flex-col items-center gap-3">
                <OilLevelSlider
                  modelYRatio={detectedRedLineYRatio}
                  remainingMl={remainingMl}
                  thumbYRatio={thumbYRatio}
                  onChange={setRemainingMl}
                />
                <CupCounter display={cupDisplay} />
              </div>

              <div className="rounded-lg border border-white/15 bg-white/8 p-3">
                <CapturedBottleImage imageSrc={capturedImage} redLineYRatio={detectedRedLineYRatio} />
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Metric label="Remaining" value={`${remainingMl} ml`} />
                  <Metric label="Consumed" value={`${consumedMl} ml`} />
                </div>
              </div>
            </div>
          )
        ) : (
          /* No-data fallback — Sally: add "Return to Scan" link */
          <div className="rounded-lg border border-red-300/40 bg-red-400/10 p-5">
            <p className="text-lg font-medium">No analyzed camera capture found</p>
            <p className="mt-2 text-sm text-neutral-200">
              Start a new scan and capture the bottle again so this screen can show the actual camera image and
              detected oil level.
            </p>
            <Link
              className="mt-4 inline-block rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5 transition-colors"
              to={`/scan?size=${encodeURIComponent(size)}`}
            >
              Return to Scan
            </Link>
          </div>
        )}

        {/* Only show Retake link for normal results — error case has its own buttons */}
        {!isErrorResult(initialResult) && initialResult && (
          <Link
            className="rounded-md border border-white/20 px-4 py-3 text-center font-semibold text-white"
            to={`/scan?size=${encodeURIComponent(size)}`}
          >
            Retake
          </Link>
        )}
      </section>
    </main>
  );
}

// Degraded view (tier: "degraded") reserved for Phase 2+ when API returns partial results

function CapturedBottleImage({ imageSrc, redLineYRatio }: { imageSrc: string; redLineYRatio: number }) {
  return (
    <div className="flex h-[min(62vh,520px)] min-h-[420px] items-center justify-center overflow-hidden rounded-md bg-black">
      <div className="relative max-h-full max-w-full">
        <img src={imageSrc} alt="Captured bottle" className="block max-h-[min(62vh,520px)] max-w-full object-contain" />
        <div
          aria-label="Detected oil level"
          className="pointer-events-none absolute left-0 right-0 h-1 bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.8)]"
          data-red-line-ratio={redLineYRatio.toFixed(4)}
          style={{ top: `${redLineYRatio * 100}%` }}
        />
      </div>
    </div>
  );
}

function OilLevelSlider({
  modelYRatio,
  remainingMl,
  thumbYRatio,
  onChange,
}: {
  modelYRatio: number;
  remainingMl: number;
  thumbYRatio: number;
  onChange: (value: number) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  function updateFromPointer(event: PointerEvent<HTMLDivElement>) {
    const rail = railRef.current;
    if (!rail) return;
    const rect = rail.getBoundingClientRect();
    const yRatio = clamp((event.clientY - rect.top) / rect.height, BOTTLE_1_5L.fillTopY, BOTTLE_1_5L.fillBottomY);
    onChange(snapMl(yRatioToMl(yRatio)));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.buttons !== 1) return;
    updateFromPointer(event);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowUp" || event.key === "PageUp") {
      event.preventDefault();
      onChange(snapMl(remainingMl + ML_PER_CUP_QUARTER));
    }
    if (event.key === "ArrowDown" || event.key === "PageDown") {
      event.preventDefault();
      onChange(snapMl(remainingMl - ML_PER_CUP_QUARTER));
    }
    if (event.key === "Home") {
      event.preventDefault();
      onChange(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      onChange(SLIDER_MAX_ML);
    }
  }

  return (
    <div
      ref={railRef}
      aria-label="Oil level"
      aria-orientation="vertical"
      aria-valuemax={SLIDER_MAX_ML}
      aria-valuemin={0}
      aria-valuenow={remainingMl}
      aria-valuetext={`${remainingMl} ml remaining`}
      className="relative h-[min(62vh,520px)] min-h-[420px] w-16 touch-none rounded-md border border-white/15 bg-white/8"
      role="slider"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    >
      <div
        aria-hidden="true"
        className="absolute left-1/2 w-2 -translate-x-1/2 rounded-full bg-white/15"
        style={{ top: `${BOTTLE_1_5L.fillTopY * 100}%`, bottom: `${(1 - BOTTLE_1_5L.fillBottomY) * 100}%` }}
      />
      <div
        aria-hidden="true"
        className="absolute left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.75)]"
        style={{ top: `${modelYRatio * 100}%` }}
      />
      <div
        aria-hidden="true"
        className="absolute left-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-amber-200 bg-neutral-950 shadow-[0_0_18px_rgba(252,211,77,0.45)]"
        data-thumb-ratio={thumbYRatio.toFixed(4)}
        style={{ top: `${thumbYRatio * 100}%` }}
      >
        <span className="h-4 w-4 rounded-full bg-amber-300" />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-black/25 px-3 py-2">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function CupCounter({ display }: { display: CupDisplay }) {
  return (
    <div className="w-full text-center" aria-label={`Cup counter ${display.label}`}>
      <div className="mx-auto flex h-14 w-12 items-end overflow-hidden rounded-b-2xl rounded-t-md border-2 border-white/60 bg-white/10">
        <div className="relative flex w-full items-center justify-center bg-amber-300 transition-[height]" style={{ height: `${display.fillPercent}%` }}>
          {display.wholeLabel ? <span className="text-sm font-black text-neutral-950">{display.wholeLabel}</span> : null}
        </div>
      </div>
      <p className="mt-2 text-xs font-semibold text-white">{display.label}</p>
    </div>
  );
}

function readCapturedImage(): string | null {
  const state = readState();
  if (!state?.capture) return null;
  const value = state.capture.captureBlob;
  return /^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(value) ? value : null;
}

function readStoredResult(): StoredAnalysisResult | null {
  const state = readState();
  if (!state?.analysis) return null;
  const a = state.analysis;

  // Check if it's an error state (persisted by CaptureShell on failure)
  if (a.tier === "error" && Array.isArray(a.errors)) {
    return {
      errors: a.errors,
      tier: "error",
      confidence: a.confidence,
      remainingMl: a.remainingMl,
    } as ErrorResult;
  }

  // Normal analysis path
  if (typeof a.remainingMl !== "number" || typeof a.redLineYRatio !== "number") return null;
  return {
    remainingMl: a.remainingMl,
    redLineYRatio: clamp(a.redLineYRatio, 0, 1),
  };
}

function readErrorContext(): { code: string; description: string; timestamp: string } | null {
  const state = readState();
  if (!state?.errorContext) return null;
  return state.errorContext as { code: string; description: string; timestamp: string };
}

function buildMailtoHref(context: { code: string; description: string; timestamp: string } | null): string {
  const email = getSupportEmail();
  const subject = encodeURIComponent("Afia App — Analysis Error");
  const body = context
    ? encodeURIComponent(
        [
          "Error details for Afia support:",
          "",
          `Error code: ${context.code}`,
          `Description: ${context.description}`,
          `Timestamp: ${context.timestamp}`,
          "",
          "Additional notes:",
        ].join("\n"),
      )
    : encodeURIComponent("Error details for Afia support:\n\n");
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

function snapMl(value: number): number {
  const snapped = Math.round(value / ML_PER_CUP_QUARTER) * ML_PER_CUP_QUARTER;
  return Math.max(0, Math.min(SLIDER_MAX_ML, snapped));
}

function mlToYRatio(remainingMl: number): number {
  const fillFraction = remainingMl / BOTTLE_1_5L.capacityMl;
  return BOTTLE_1_5L.fillBottomY - fillFraction * (BOTTLE_1_5L.fillBottomY - BOTTLE_1_5L.fillTopY);
}

function yRatioToMl(yRatio: number): number {
  const fillFraction = (BOTTLE_1_5L.fillBottomY - yRatio) / (BOTTLE_1_5L.fillBottomY - BOTTLE_1_5L.fillTopY);
  return fillFraction * BOTTLE_1_5L.capacityMl;
}

interface CupDisplay {
  fillPercent: number;
  label: string;
  wholeLabel: string;
}

function formatCups(consumedMl: number): CupDisplay {
  const quarterIndex = Math.round(consumedMl / ML_PER_CUP_QUARTER);
  const whole = Math.floor(quarterIndex / 4);
  const fraction = quarterIndex % 4;
  const fractionText = fraction === 0 ? "" : fraction === 1 ? "1/4" : fraction === 2 ? "1/2" : "3/4";
  const labelParts = [whole > 0 ? String(whole) : "", fractionText].filter(Boolean);
  const cupAmount = labelParts.length > 0 ? labelParts.join(" ") : "0";
  const cupWord = quarterIndex === 4 ? "Cup" : "Cups";
  const fillQuarter = fraction === 0 && quarterIndex > 0 ? 4 : fraction;

  return {
    fillPercent: fillQuarter * 25,
    label: `${cupAmount} ${cupWord} consumed`,
    wholeLabel: whole > 0 ? String(whole) : "",
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
