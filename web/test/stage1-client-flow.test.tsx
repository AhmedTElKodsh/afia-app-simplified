import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { I18nProvider } from "../src/i18n";
import { ThemeProvider } from "../src/theme";

const analysisId = "0d44aecc-8344-44c8-8b7f-201216f7c9f9";

function renderApp(initialPath: string) {
  return render(
    <I18nProvider>
      <ThemeProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <App />
        </MemoryRouter>
      </ThemeProvider>
    </I18nProvider>,
  );
}

describe("Stage 1 client flow", () => {
  const drawImage = vi.fn();
  const records: AnalysisRecord[] = [];

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    records.length = 0;
    drawImage.mockClear();

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/analyze") {
        const body = JSON.parse(String(init?.body)) as { imageBase64: string };
        records.unshift({
          id: analysisId,
          createdAt: "2026-05-10T10:00:00.000Z",
          bottleSize: "1.5L",
          imageUrl: body.imageBase64,
          remainingMl: 900,
          consumedMl: 600,
          redLineYRatio: 0.42,
          confidence: 0.87,
          warnings: [],
          provider: "gemini",
          promptVersion: "v1",
          modelId: "gemini-2.5-flash",
          rawModelText: "{}",
          correctionStatus: "pending_review",
          adminFlag: null,
          adminCorrectedMl: null,
          adminNote: null,
        });
        return jsonResponse({
          analysisId,
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
        });
      }

      if (url.startsWith("/api/admin/analyses?")) {
        return jsonResponse({ analyses: records });
      }

      if (url.startsWith("/api/admin/analyses/")) {
        Object.assign(records[0], {
          correctionStatus: "manual_corrected",
          adminFlag: "too_big",
          adminCorrectedMl: 825,
          adminNote: "Adjusted after review",
        });
        return jsonResponse({ analysis: records[0] });
      }

      return new Response("not found", { status: 404 });
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
    localStorage.clear();
    sessionStorage.clear();
  });

  it("moves from mock QR capture to analyzed result and admin correction", async () => {
    const scanFlow = renderApp("/mock-qr");

    fireEvent.click(screen.getByRole("link", { name: /scan afia 1\.5l/i }));
    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });
    fireEvent.canPlay(document.querySelector("video")!);
    fireEvent.click(screen.getByRole("button", { name: /capture/i }));

    expect(await screen.findByRole("slider", { name: /oil level/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /captured bottle/i })).toHaveAttribute(
      "src",
      "data:image/jpeg;base64,captured-frame",
    );
    expect(sessionStorage.getItem("afia.analysis")).toContain("\"remainingMl\":900");
    expect(records[0]).toMatchObject({
      id: analysisId,
      correctionStatus: "pending_review",
      remainingMl: 900,
    });

    scanFlow.unmount();
    localStorage.setItem("afia.adminToken", "secret");
    renderApp("/admin");

    expect(await screen.findByText(/900 ml remaining/i)).toBeInTheDocument();
    fireEvent.change(screen.getAllByLabelText(/^status$/i)[1], { target: { value: "manual_corrected" } });
    fireEvent.change(screen.getByLabelText(/^flag$/i), { target: { value: "too_big" } });
    fireEvent.change(screen.getByLabelText(/corrected ml/i), { target: { value: "825" } });
    fireEvent.change(screen.getByLabelText(/^note$/i), { target: { value: "Adjusted after review" } });
    fireEvent.click(screen.getByRole("button", { name: /save correction/i }));

    await waitFor(() => {
      expect(records[0]).toMatchObject({
        correctionStatus: "manual_corrected",
        adminFlag: "too_big",
        adminCorrectedMl: 825,
        adminNote: "Adjusted after review",
      });
    });
  });
});

type AnalysisRecord = {
  id: string;
  createdAt: string;
  bottleSize: "1.5L";
  imageUrl: string;
  remainingMl: number;
  consumedMl: number;
  redLineYRatio: number;
  confidence: number;
  warnings: string[];
  provider: "gemini";
  promptVersion: string;
  modelId: string;
  rawModelText: string;
  correctionStatus: "pending_review" | "manual_corrected";
  adminFlag: string | null;
  adminCorrectedMl: number | null;
  adminNote: string | null;
};

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}
