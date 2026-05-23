import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { I18nProvider } from "../src/i18n";
import { ThemeProvider } from "../src/theme";

function renderScan() {
  return render(
    <I18nProvider>
      <ThemeProvider>
        <MemoryRouter initialEntries={["/scan?size=1.5L"]}>
          <App />
        </MemoryRouter>
      </ThemeProvider>
    </I18nProvider>,
  );
}

describe("camera capture shell", () => {
  const drawImage = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    drawImage.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        analysisId: "0d44aecc-8344-44c8-8b7f-201216f7c9f9",
        remainingMl: 900,
        consumedMl: 600,
        redLineYRatio: 0.42,
        confidence: 0.87,
        warnings: [],
        provider: "gemini",
        rawMetadata: {
          promptVersion: "v1",
          modelId: "gemini-2.5-flash",
        },
      }),
    }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,captured-frame");
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
      configurable: true,
      value: 640,
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
      configurable: true,
      value: 480,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("requests the environment camera and shows the 1.5L front-side capture guide", async () => {
    renderScan();

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
    });

    expect(screen.getByText(/photograph the front of the bottle/i)).toBeInTheDocument();
    expect(screen.getByText(/aim slightly downward/i)).toBeInTheDocument();
    const guide = screen.getByLabelText(/1\.5l bottle distance and downward phone angle guide/i);
    expect(guide).toBeInTheDocument();
    expect(guide).not.toHaveClass("border-4");
    expect(screen.getByTestId("bottle-outline-mask")).toHaveStyle({
      backgroundColor: "#f87171",
      maskRepeat: "no-repeat",
    });
    expect(screen.getByText(/place the bottle inside the outline|align the bottle with the outline/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /capture/i })).toBeDisabled();
  });

  it("captures the ready video frame, analyzes it, and navigates to the result page", async () => {
    renderScan();

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });

    fireEvent.canPlay(document.querySelector("video")!);
    fireEvent.click(screen.getByRole("button", { name: /capture/i }));
    expect(drawImage).toHaveBeenCalled();
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/analyze", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          bottleSize: "1.5L",
          imageBase64: "data:image/jpeg;base64,captured-frame",
        }),
      }));
    });
    expect(sessionStorage.getItem("afia.capture")).toBe("data:image/jpeg;base64,captured-frame");
    expect(sessionStorage.getItem("afia.captureSource")).toBe("camera");
    expect(sessionStorage.getItem("afia.analysis")).toContain("\"remainingMl\":900");
    expect(sessionStorage.getItem("afia.state")).toContain("0d44aecc-8344-44c8-8b7f-201216f7c9f9");
    expect(screen.getByRole("slider", { name: /oil level/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /captured bottle/i })).toHaveAttribute(
      "src",
      "data:image/jpeg;base64,captured-frame",
    );
    expect(screen.getByRole("link", { name: /retake/i })).toHaveAttribute("href", "/scan?size=1.5L");
  });

  it("navigates to result with error card when API analysis fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ error: "LLM analysis failed" }),
    } as Response);
    renderScan();

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });

    fireEvent.canPlay(document.querySelector("video")!);
    fireEvent.click(screen.getByRole("button", { name: /capture/i }));

    // Error state persisted to sessionStorage
    await waitFor(() => {
      const stored = sessionStorage.getItem("afia.analysis");
      expect(stored).not.toBeNull();
      expect(stored).toContain("ANALYSIS_FAILED");
    });

    // ResultShell renders the error card with exact heading text
    expect(await screen.findByText("Analysis Failed")).toBeInTheDocument();
    expect(screen.getByText(/ANALYSIS_FAILED/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /retry scan/i })).toHaveAttribute(
      "href",
      "/scan?size=1.5L&retry=true",
    );
    expect(screen.getByRole("link", { name: /contact support/i })).toBeInTheDocument();
  });

  it("turns the outline green and auto-captures after a stable match", async () => {
    const sample = new Uint8ClampedArray(96 * 128 * 4);
    for (let y = 0; y < 128; y += 1) {
      for (let x = 0; x < 96; x += 1) {
        const i = (y * 96 + x) * 4;
        const insideBottle = x >= 29 && x <= 67 && y >= 19 && y <= 90;
        const value = insideBottle ? 40 : 220;
        sample[i] = value;
        sample[i + 1] = value;
        sample[i + 2] = value;
        sample[i + 3] = 255;
      }
    }
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue({
      drawImage,
      getImageData: vi.fn(() => ({ data: sample })),
    } as unknown as CanvasRenderingContext2D);

    renderScan();

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });
    fireEvent.canPlay(document.querySelector("video")!);

    expect(await screen.findByText(/capturing automatically/i, undefined, { timeout: 2500 })).toBeInTheDocument();
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/analyze", expect.objectContaining({ method: "POST" }));
    }, { timeout: 2500 });
  }, 6000);

  it("does not auto-capture while the detected bottle bounds are still shifting", async () => {
    const stable = makeGuideSample({ left: 29, right: 67, top: 19, bottom: 90 });
    const shifted = makeGuideSample({ left: 35, right: 73, top: 19, bottom: 90 });
    let calls = 0;
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue({
      drawImage,
      getImageData: vi.fn(() => ({ data: calls++ % 2 === 0 ? stable : shifted })),
    } as unknown as CanvasRenderingContext2D);

    renderScan();

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });
    fireEvent.canPlay(document.querySelector("video")!);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2200));
    });

    expect(screen.getByText(/hold steady/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  }, 7000);

  it("keeps auto-capture blocked when the bottle is partially outside the frame", async () => {
    const partial = makeGuideSample({ left: 0, right: 38, top: 0, bottom: 71 });
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue({
      drawImage,
      getImageData: vi.fn(() => ({ data: partial })),
    } as unknown as CanvasRenderingContext2D);

    renderScan();

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });
    fireEvent.canPlay(document.querySelector("video")!);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 900));
    });

    expect(screen.getByText(/show the full bottle/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  }, 5000);

  it("rejects glare-heavy captures before analysis", async () => {
    const glareFrame = makeQualityFrame({ width: 640, height: 480, base: 96, glareEvery: 4 });
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue({
      drawImage,
      getImageData: vi.fn(() => ({ data: glareFrame })),
    } as unknown as CanvasRenderingContext2D);

    renderScan();

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });
    fireEvent.canPlay(document.querySelector("video")!);
    fireEvent.click(screen.getByRole("button", { name: /capture/i }));

    expect(await screen.findByText(/reduce glare/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});

function makeGuideSample(bounds: { left: number; right: number; top: number; bottom: number }) {
  const sample = new Uint8ClampedArray(96 * 128 * 4);
  for (let y = 0; y < 128; y += 1) {
    for (let x = 0; x < 96; x += 1) {
      const i = (y * 96 + x) * 4;
      const insideBottle = x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
      const value = insideBottle ? 40 : 220;
      sample[i] = value;
      sample[i + 1] = value;
      sample[i + 2] = value;
      sample[i + 3] = 255;
    }
  }
  return sample;
}

function makeQualityFrame(options: { width: number; height: number; base: number; glareEvery: number }) {
  const sample = new Uint8ClampedArray(options.width * options.height * 4);
  for (let pixel = 0; pixel < options.width * options.height; pixel += 1) {
    const i = pixel * 4;
    const value = pixel % options.glareEvery === 0 ? 255 : options.base;
    sample[i] = value;
    sample[i + 1] = value;
    sample[i + 2] = value;
    sample[i + 3] = 255;
  }
  return sample;
}
