import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    expect(screen.getByLabelText(/1\.5l bottle distance and downward phone angle guide/i)).toBeInTheDocument();
    expect(screen.getByText(/phone angled down, bottle fully visible/i)).toBeInTheDocument();
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
});
