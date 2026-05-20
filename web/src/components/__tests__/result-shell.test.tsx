import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResultShell } from "../ResultShell";
import { writeState } from "../../storage/sessionState";

const IMAGE = "data:image/jpeg;base64,ZmFrZQ==";

describe("ResultShell correction feedback", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("submits the adjusted slider value for admin review", async () => {
    writeState({
      capture: {
        captureBlob: IMAGE,
        captureSource: "camera",
        capturedAt: "2026-05-19T10:00:00.000Z",
      },
      analysis: {
        analysisId: "0d44aecc-8344-44c8-8b7f-201216f7c9f9",
        remainingMl: 770,
        redLineYRatio: 0.52,
        tier: "success",
        confidence: 0.8,
      },
    });

    render(
      <MemoryRouter initialEntries={["/result?size=1.5L"]}>
        <Routes>
          <Route path="/result" element={<ResultShell />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.keyDown(screen.getByRole("slider", { name: "Oil level" }), { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("button", { name: "Submit correction" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/analyses/0d44aecc-8344-44c8-8b7f-201216f7c9f9/user-correction",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          correctedRemainingMl: 715,
          acceptedEstimate: false,
          note: "Customer adjusted slider on result screen",
        }),
      }),
    ));
    expect(await screen.findByText("Saved for review")).toBeInTheDocument();
  });
});
