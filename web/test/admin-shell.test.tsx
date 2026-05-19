import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { I18nProvider } from "../src/i18n";
import { ThemeProvider } from "../src/theme";

const analysis = {
  id: "0d44aecc-8344-44c8-8b7f-201216f7c9f9",
  createdAt: "2026-05-10T10:00:00.000Z",
  bottleSize: "1.5L",
  imageUrl: "https://example.com/image.jpg",
  remainingMl: 900,
  consumedMl: 600,
  redLineYRatio: 0.42,
  confidence: 0.8,
  warnings: [],
  provider: "gemini",
  promptVersion: "v1",
  modelId: "gemini-test",
  rawModelText: "{}",
  correctionStatus: "pending_review",
  adminFlag: null,
  adminCorrectedMl: null,
  adminNote: null,
};

function renderAdmin() {
  return render(
    <I18nProvider>
      <ThemeProvider>
        <MemoryRouter initialEntries={["/admin"]}>
          <App />
        </MemoryRouter>
      </ThemeProvider>
    </I18nProvider>,
  );
}

describe("admin shell", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/admin/analyses?")) {
        return new Response(JSON.stringify({ analyses: [analysis] }), { status: 200 });
      }
      if (url.startsWith("/api/admin/analyses/")) {
        return new Response(JSON.stringify({
          analysis: {
            ...analysis,
            correctionStatus: "manual_corrected",
            adminFlag: "too_big",
            adminCorrectedMl: 825,
            adminNote: "Adjusted",
          },
        }), { status: 200 });
      }
      if (url === "/api/admin/upload") {
        return new Response(JSON.stringify({ analysis }), { status: 201 });
      }
      return new Response("not found", { status: 404 });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("lists analysis records and saves corrections", async () => {
    renderAdmin();

    expect(await screen.findByText(/900 ml remaining/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^token$/i), { target: { value: "secret" } });
    fireEvent.change(screen.getAllByLabelText(/^status$/i)[1], { target: { value: "manual_corrected" } });
    fireEvent.change(screen.getByLabelText(/^flag$/i), { target: { value: "too_big" } });
    fireEvent.change(screen.getByLabelText(/corrected ml/i), { target: { value: "825" } });
    fireEvent.change(screen.getByLabelText(/^note$/i), { target: { value: "Adjusted" } });
    fireEvent.click(screen.getByRole("button", { name: /save correction/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/analyses/0d44aecc-8344-44c8-8b7f-201216f7c9f9",
        expect.objectContaining({
          method: "PATCH",
          headers: expect.objectContaining({ authorization: "Bearer secret" }),
          body: JSON.stringify({
            correctionStatus: "manual_corrected",
            adminFlag: "too_big",
            adminCorrectedMl: 825,
            adminNote: "Adjusted",
          }),
        }),
      );
    });
  });

  it("uploads manual ground-truth images", async () => {
    renderAdmin();

    fireEvent.click(screen.getByRole("button", { name: /manual upload/i }));
    fireEvent.change(screen.getByLabelText(/^token$/i), { target: { value: "secret" } });
    fireEvent.change(screen.getByLabelText(/ground truth/i), { target: { value: "770" } });
    fireEvent.change(screen.getByLabelText(/^note$/i), { target: { value: "Ground truth" } });

    Object.defineProperty(HTMLInputElement.prototype, "files", {
      configurable: true,
      value: [new File(["fake"], "bottle.jpg", { type: "image/jpeg" })],
    });
    vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(function read() {
      Object.defineProperty(this, "result", { configurable: true, value: "data:image/jpeg;base64,fake" });
      this.onload?.({} as ProgressEvent<FileReader>);
    });
    fireEvent.change(screen.getByLabelText(/bottle image/i));

    await screen.findByRole("img", { name: /manual upload preview/i });
    fireEvent.click(screen.getByRole("button", { name: /save manual upload/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/upload",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ authorization: "Bearer secret" }),
          body: JSON.stringify({
            bottleSize: "1.5L",
            imageBase64: "data:image/jpeg;base64,fake",
            remainingMl: 770,
            adminNote: "Ground truth",
          }),
        }),
      );
    });
  });
});
