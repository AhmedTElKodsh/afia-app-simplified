import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import bottleCleanOutlineUrl from "../../../oil-bottle-frames/afia-bottle-clean.svg";
import { AnalysisResultSchema, DEFAULT_BOTTLE_SIZE, type AnalysisResultContract } from "@afia/shared";
import { ERROR_CODES, getSupportEmail } from "../errors";
import { writeState } from "../storage/sessionState";

type CameraState = "starting" | "ready" | "missing" | "blocked" | "capture-failed" | "analyzing" | "analysis-failed";

export function CaptureShell() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraState, setCameraState] = useState<CameraState>("starting");
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState("missing");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraState("ready");
      } catch {
        setCameraState("blocked");
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const canCapture = (cameraState === "ready" || cameraState === "analysis-failed") && videoReady;

  async function captureFrame() {
    const video = videoRef.current;
    if (!video || !canCapture) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (width <= 0 || height <= 0) {
      setCameraState("capture-failed");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraState("capture-failed");
      return;
    }

    context.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    writeState({
      capture: {
        captureSource: "camera",
        captureBlob: dataUrl,
        capturedAt: new Date().toISOString(),
      },
    });
    writeLegacySessionValue("afia.capture", dataUrl);
    writeLegacySessionValue("afia.captureSource", "camera");
    setCameraState("analyzing");

    try {
      const { analysis, analysisId } = await analyzeCapture(dataUrl);
      writeState({ analysis: { ...analysis, analysisId, tier: "success" as const } });
      writeLegacySessionValue("afia.analysis", JSON.stringify(analysis));
      navigate(`/result?size=${encodeURIComponent(DEFAULT_BOTTLE_SIZE)}`);
    } catch (err) {
      const description =
        err instanceof Error
          ? err.message
          : "Analysis request failed. Check your connection and try again.";
      const errorAnalysis = {
        errors: [
          {
            code: ERROR_CODES.ANALYSIS_FAILED,
            description,
          },
        ],
        tier: "error" as const,
        confidence: 0,
        remainingMl: null,
      };
      const errorContext = {
        code: ERROR_CODES.ANALYSIS_FAILED,
        description: err instanceof Error ? err.message : "Unknown error",
        timestamp: new Date().toISOString(),
        supportEmail: getSupportEmail(),
      };

      // Persist structured error state per D-14
      writeState({
        analysis: errorAnalysis,
        errorContext,
      });
      writeLegacySessionValue("afia.analysis", JSON.stringify(errorAnalysis));
      writeLegacySessionValue("afia.errorContext", JSON.stringify(errorContext));
      setCameraState("analysis-failed");
      // Navigate to result page with ?retry=true (Sally: preserve camera config on retry)
      navigate(
        `/result?size=${encodeURIComponent(DEFAULT_BOTTLE_SIZE)}&retry=true`,
      );
    }
  }

  return (
    <div className="rounded-lg border border-white/15 bg-white/8 p-4">
      <p className="text-lg font-medium">Photograph the FRONT of the bottle</p>
      <p className="mt-2 text-sm text-neutral-300">
        Aim slightly downward from hand height. Keep the upright bottle small in frame with space around it.
      </p>

      <div className="relative mt-5 aspect-[3/4] overflow-hidden rounded-md bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          autoPlay
          muted
          playsInline
          onCanPlay={() => setVideoReady(true)}
        />
        <div className="pointer-events-none absolute inset-x-[14%] top-[9%] h-px bg-white/20" />
        <div className="pointer-events-none absolute inset-x-[14%] bottom-[9%] h-px bg-white/20" />
        <div
          aria-label="1.5L bottle distance and downward phone angle guide"
          className="pointer-events-none absolute left-1/2 top-[15%] h-[56%] w-[40%] -translate-x-1/2"
        >
          <img
            src={bottleCleanOutlineUrl}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-contain opacity-45"
            draggable={false}
          />
        </div>
        <div className="pointer-events-none absolute bottom-4 left-3 right-3 rounded bg-black/55 px-3 py-2 text-center text-xs font-medium text-white/90">
          Phone angled down, bottle fully visible
        </div>
      </div>

      {cameraState === "missing" ? (
        <p className="mt-4 rounded-md bg-red-500/15 p-3 text-sm text-red-100">
          Camera access is not available in this browser.
        </p>
      ) : null}
      {cameraState === "blocked" ? (
        <p className="mt-4 rounded-md bg-red-500/15 p-3 text-sm text-red-100">
          Camera permission was blocked. Allow camera access and reload to continue.
        </p>
      ) : null}
      {cameraState === "capture-failed" ? (
        <p className="mt-4 rounded-md bg-red-500/15 p-3 text-sm text-red-100">
          Could not capture an image from the camera. Check the preview and try again.
        </p>
      ) : null}
      {cameraState === "analysis-failed" ? (
        <p className="mt-4 rounded-md bg-red-500/15 p-3 text-sm text-red-100">
          Could not analyze this capture. Check the connection and try again.
        </p>
      ) : null}

      <button
        className="mt-5 w-full rounded-md bg-amber-300 px-4 py-3 font-semibold text-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-500 disabled:text-neutral-200"
        type="button"
        disabled={!canCapture}
        onClick={captureFrame}
      >
        {cameraState === "analyzing" ? "Analyzing..." : "Capture"}
      </button>
    </div>
  );
}

async function analyzeCapture(imageBase64: string): Promise<{ analysis: AnalysisResultContract; analysisId?: string }> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      bottleSize: DEFAULT_BOTTLE_SIZE,
      imageBase64,
    }),
  });

  if (!response.ok) throw new Error(`Analysis failed with ${response.status}`);
  const body = await response.json();
  return {
    analysis: AnalysisResultSchema.parse(body),
    analysisId: typeof body?.analysisId === "string" ? body.analysisId : undefined,
  };
}

function writeLegacySessionValue(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Keep primary envelope write as source of truth when legacy compatibility fails.
  }
}
