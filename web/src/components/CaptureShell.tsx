import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import bottleCleanOutlineUrl from "../../../oil-bottle-frames/afia-bottle-clean.svg";
import { AnalysisResultSchema, DEFAULT_BOTTLE_SIZE, type AnalysisResultContract } from "@afia/shared";
import { ERROR_CODES, getSupportEmail } from "../errors";
import { writeState } from "../storage/sessionState";

type CameraState = "starting" | "ready" | "missing" | "blocked" | "capture-failed" | "analyzing" | "analysis-failed";
type GuideState = "searching" | "adjusting" | "locked";

interface FrameGuide {
  state: GuideState;
  message: string;
  score: number;
  box?: GuideBox;
}

interface GuideBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

const GUIDE_TARGET = {
  left: 0.30,
  top: 0.15,
  width: 0.40,
  height: 0.56,
};
const GUIDE_SAMPLE_WIDTH = 96;
const GUIDE_SAMPLE_HEIGHT = 128;
const PREVIEW_ASPECT_RATIO = 3 / 4;
const AUTO_CAPTURE_LOCK_MS = 900;
const GUIDE_OUTLINE_PALETTE: Record<GuideState, { color: string; glow: string }> = {
  searching: { color: "#f87171", glow: "rgba(248,113,113,0.62)" },
  adjusting: { color: "#fdba74", glow: "rgba(253,186,116,0.56)" },
  locked: { color: "#6ee7b7", glow: "rgba(110,231,183,0.65)" },
};

export function CaptureShell() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const autoCaptureStartedRef = useRef(false);
  const greenSinceRef = useRef<number | null>(null);
  const lockedBoxesRef = useRef<GuideBox[]>([]);
  const [cameraState, setCameraState] = useState<CameraState>("starting");
  const [guide, setGuide] = useState<FrameGuide>({
    state: "searching",
    message: "Place the bottle inside the outline",
    score: 0,
  });
  const [autoCaptureArmed, setAutoCaptureArmed] = useState(false);
  const [qualityMessage, setQualityMessage] = useState<string | null>(null);
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

  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !canCapture) return;

    const rawWidth = video.videoWidth;
    const rawHeight = video.videoHeight;
    if (rawWidth <= 0 || rawHeight <= 0) {
      setCameraState("capture-failed");
      return;
    }
    const { width, height } = previewFrameSize(rawWidth, rawHeight);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraState("capture-failed");
      return;
    }

    drawVideoPreviewFrame(video, context, width, height);
    const quality = assessFrameQuality(context, width, height);
    if (!quality.ok) {
      setQualityMessage(quality.message);
      setCameraState("capture-failed");
      return;
    }
    setQualityMessage(null);

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
  }, [canCapture, navigate]);

  useEffect(() => {
    if (!canCapture || cameraState !== "ready") {
      greenSinceRef.current = null;
      autoCaptureStartedRef.current = false;
      lockedBoxesRef.current = [];
      setAutoCaptureArmed(false);
      return;
    }

    let cancelled = false;
    let timeoutId: number | undefined;
    const canvas = document.createElement("canvas");
    canvas.width = GUIDE_SAMPLE_WIDTH;
    canvas.height = GUIDE_SAMPLE_HEIGHT;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    const tick = () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        const nextGuide = analyzeGuideFrame(context, video, GUIDE_SAMPLE_WIDTH, GUIDE_SAMPLE_HEIGHT);
        setGuide(nextGuide);

        const now = Date.now();
        if (nextGuide.state === "locked" && nextGuide.box) {
          lockedBoxesRef.current = [...lockedBoxesRef.current.slice(-2), nextGuide.box];
          const boundsStable = lockedBoxesRef.current.length >= 3 && guideBoundsAreStable(lockedBoxesRef.current);
          if (!boundsStable) {
            greenSinceRef.current = null;
            setAutoCaptureArmed(false);
          } else {
            greenSinceRef.current ??= now;
            setAutoCaptureArmed(true);
            if (!autoCaptureStartedRef.current && now - greenSinceRef.current >= AUTO_CAPTURE_LOCK_MS) {
              autoCaptureStartedRef.current = true;
              void captureFrame();
              return;
            }
          }
        } else {
          greenSinceRef.current = null;
          lockedBoxesRef.current = [];
          setAutoCaptureArmed(false);
        }
      }
      timeoutId = window.setTimeout(tick, 240);
    };

    timeoutId = window.setTimeout(tick, 120);
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [cameraState, canCapture, captureFrame]);

  const displayGuideState = guide.state === "locked" && !autoCaptureArmed ? "adjusting" : guide.state;
  const guideMessage = guide.state === "locked"
    ? autoCaptureArmed ? "Capturing automatically" : "Hold steady"
    : guide.message;
  const guideOutline = GUIDE_OUTLINE_PALETTE[displayGuideState];
  const guideOutlineStyle: CSSProperties = {
    backgroundColor: guideOutline.color,
    filter: `drop-shadow(0 0 10px ${guideOutline.glow})`,
    maskImage: `url(${bottleCleanOutlineUrl})`,
    maskPosition: "center",
    maskRepeat: "no-repeat",
    maskSize: "contain",
    transition: "background-color 160ms ease, filter 160ms ease",
    WebkitMaskImage: `url(${bottleCleanOutlineUrl})`,
    WebkitMaskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
  };
  const guideTintClass =
    displayGuideState === "locked"
      ? "bg-emerald-400/90 text-neutral-950"
      : displayGuideState === "adjusting"
        ? "bg-orange-300/90 text-neutral-950"
        : "bg-red-500/90 text-white";

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
          data-guide-state={displayGuideState}
          data-guide-score={guide.score.toFixed(2)}
        >
          <div
            aria-hidden="true"
            className="h-full w-full opacity-95"
            data-testid="bottle-outline-mask"
            style={guideOutlineStyle}
          />
        </div>
        <div
          className={`pointer-events-none absolute bottom-4 left-3 right-3 rounded px-3 py-2 text-center text-xs font-semibold transition-colors ${guideTintClass}`}
          aria-live="polite"
        >
          {guideMessage}
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
          {qualityMessage ?? "Could not capture an image from the camera. Check the preview and try again."}
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
        {cameraState === "analyzing" ? "Analyzing..." : autoCaptureArmed ? "Capturing..." : "Capture"}
      </button>
    </div>
  );
}

function analyzeGuideFrame(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
): FrameGuide {
  if (typeof context.getImageData !== "function") {
    return { state: "adjusting", message: "Align the bottle with the outline", score: 0.45 };
  }

  try {
    drawVideoPreviewFrame(video, context, width, height);
    const { data } = context.getImageData(0, 0, width, height);
    const luminance = new Float32Array(width * height);
    let sum = 0;
    let squares = 0;

    for (let pixel = 0; pixel < luminance.length; pixel += 1) {
      const i = pixel * 4;
      const value = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      luminance[pixel] = value;
      sum += value;
      squares += value * value;
    }

    const mean = sum / luminance.length;
    const variance = Math.max(0, squares / luminance.length - mean * mean);
    const threshold = Math.max(22, Math.sqrt(variance) * 0.7);
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let count = 0;

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const pixel = y * width + x;
        const edge = Math.abs(luminance[pixel] - luminance[pixel - 1]) + Math.abs(luminance[pixel] - luminance[pixel - width]);
        const contrast = Math.abs(luminance[pixel] - mean);
        if (edge > threshold || contrast > threshold * 1.5) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          count += 1;
        }
      }
    }

    if (count < width * height * 0.018 || maxX <= minX || maxY <= minY) {
      return { state: "searching", message: "Place the bottle inside the outline", score: 0 };
    }

    const box: GuideBox = {
      left: minX / width,
      top: minY / height,
      width: (maxX - minX + 1) / width,
      height: (maxY - minY + 1) / height,
    };
    const targetCenterX = GUIDE_TARGET.left + GUIDE_TARGET.width / 2;
    const targetCenterY = GUIDE_TARGET.top + GUIDE_TARGET.height / 2;
    const boxCenterX = box.left + box.width / 2;
    const boxCenterY = box.top + box.height / 2;
    const centerDx = boxCenterX - targetCenterX;
    const centerDy = boxCenterY - targetCenterY;
    const widthDiff = box.width - GUIDE_TARGET.width;
    const heightDiff = box.height - GUIDE_TARGET.height;
    const touchesFrameEdge =
      box.left <= 0.04 ||
      box.top <= 0.04 ||
      box.left + box.width >= 0.96 ||
      box.top + box.height >= 0.96;
    const pixelAspect = (box.height * height) / Math.max(1, box.width * width);
    const shapeScore = Math.max(
      Math.abs(centerDx) / 0.17,
      Math.abs(centerDy) / 0.16,
      Math.abs(widthDiff) / 0.20,
      Math.abs(heightDiff) / 0.24,
    );
    const score = clamp(1 - shapeScore, 0, 1);

    if (touchesFrameEdge) {
      return {
        state: "adjusting",
        message: "Show the full bottle",
        score,
        box,
      };
    }
    if (pixelAspect < 1.35) {
      return {
        state: "adjusting",
        message: "Keep bottle upright",
        score,
        box,
      };
    }

    if (Math.abs(widthDiff) > 0.12 || Math.abs(heightDiff) > 0.14) {
      return {
        state: "adjusting",
        message: widthDiff < 0 || heightDiff < 0 ? "Move closer" : "Move farther",
        score,
      };
    }
    if (Math.abs(centerDx) > 0.07) {
      return {
        state: "adjusting",
        message: centerDx < 0 ? "Move slightly right" : "Move slightly left",
        score,
      };
    }
    if (Math.abs(centerDy) > 0.06) {
      return {
        state: "adjusting",
        message: centerDy < 0 ? "Tilt phone slightly upward" : "Tilt phone slightly downward",
        score,
      };
    }

    return score > 0.68
      ? { state: "locked", message: "Locked - capturing automatically", score, box }
      : { state: "adjusting", message: "Match the bottle shape to the outline", score };
  } catch {
    return { state: "adjusting", message: "Align the bottle with the outline", score: 0.45 };
  }
}

function guideBoundsAreStable(boxes: GuideBox[]): boolean {
  const latest = boxes[boxes.length - 1];
  return boxes.every((box) =>
    Math.abs(box.left - latest.left) <= 0.025 &&
    Math.abs(box.top - latest.top) <= 0.025 &&
    Math.abs(box.width - latest.width) <= 0.03 &&
    Math.abs(box.height - latest.height) <= 0.03,
  );
}

function previewFrameSize(rawWidth: number, rawHeight: number): { width: number; height: number } {
  const rawAspect = rawWidth / rawHeight;
  if (rawAspect > PREVIEW_ASPECT_RATIO) {
    return {
      width: Math.round(rawHeight * PREVIEW_ASPECT_RATIO),
      height: rawHeight,
    };
  }

  return {
    width: rawWidth,
    height: Math.round(rawWidth / PREVIEW_ASPECT_RATIO),
  };
}

function drawVideoPreviewFrame(
  video: HTMLVideoElement,
  context: CanvasRenderingContext2D,
  targetWidth: number,
  targetHeight: number,
): void {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = targetWidth / targetHeight;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (sourceAspect > targetAspect) {
    sw = sourceHeight * targetAspect;
    sx = (sourceWidth - sw) / 2;
  } else if (sourceAspect < targetAspect) {
    sh = sourceWidth / targetAspect;
    sy = (sourceHeight - sh) / 2;
  }

  context.drawImage(video, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
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

function assessFrameQuality(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): { ok: true } | { ok: false; message: string } {
  if (width < 360 || height < 360) {
    return { ok: false, message: "Image resolution is too low. Move closer after keeping the full bottle visible." };
  }
  if (typeof context.getImageData !== "function") return { ok: true };

  try {
    const { data } = context.getImageData(0, 0, width, height);
    const stride = Math.max(4, Math.floor(data.length / 4096 / 4) * 4);
    let count = 0;
    let luminanceSum = 0;
    let luminanceSquares = 0;
    let focusSum = 0;
    let glareCount = 0;
    let previous = 0;

    for (let index = 0; index < data.length; index += stride) {
      const luminance = 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
      luminanceSum += luminance;
      luminanceSquares += luminance * luminance;
      if (count > 0) focusSum += Math.abs(luminance - previous);
      if (luminance > 248) glareCount += 1;
      previous = luminance;
      count += 1;
    }

    if (count === 0) return { ok: true };
    const mean = luminanceSum / count;
    const variance = luminanceSquares / count - mean * mean;
    const focusScore = count > 1 ? focusSum / (count - 1) : 0;
    const glareRatio = glareCount / count;

    if (mean < 32) return { ok: false, message: "Lighting is too dark. Move to brighter light and retake the photo." };
    if (glareRatio > 0.12) return { ok: false, message: "Reduce glare and retake the photo." };
    if (mean > 245) return { ok: false, message: "The image is overexposed. Reduce glare and retake the photo." };
    if (variance < 18 || focusScore < 1.5) {
      return { ok: false, message: "The image is too blurry or flat. Hold the phone steady and retake the photo." };
    }
  } catch {
    return { ok: true };
  }

  return { ok: true };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
