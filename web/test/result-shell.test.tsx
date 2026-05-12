import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../src/App";
import { I18nProvider } from "../src/i18n";
import { ThemeProvider } from "../src/theme";

function renderResult() {
  return render(
    <I18nProvider>
      <ThemeProvider>
        <MemoryRouter initialEntries={["/result?size=1.5L"]}>
          <App />
        </MemoryRouter>
      </ThemeProvider>
    </I18nProvider>,
  );
}

describe("result shell", () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem("afia.capture", "data:image/jpeg;base64,captured-frame");
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("renders the captured image with a red oil-level overlay and left slider", () => {
    setStoredAnalysis();

    const { container } = renderResult();

    expect(screen.getByRole("heading", { name: /afia 1\.5l/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /captured bottle/i })).toHaveAttribute(
      "src",
      "data:image/jpeg;base64,captured-frame",
    );
    expect(screen.getByLabelText(/detected oil level/i)).toHaveAttribute("data-red-line-ratio", "0.4200");
    expect(container.querySelector("[data-thumb-ratio]")).toHaveAttribute("data-thumb-ratio", "0.4200");
    expect(screen.getByRole("slider", { name: /oil level/i })).toHaveAttribute("aria-valuenow", "880");
    expect(screen.getByRole("slider", { name: /oil level/i })).toHaveAttribute("aria-valuemax", "1485");
    expect(screen.getByText(/880 ml/i)).toBeInTheDocument();
    expect(screen.getByText(/620 ml/i)).toBeInTheDocument();
    expect(screen.getByText(/2 3\/4 cups consumed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cup counter 2 3\/4 cups consumed/i)).toBeInTheDocument();
  });

  it("updates remaining ml, consumed ml, and cup counter in 55ml keyboard steps while keeping the detected red line fixed", () => {
    setStoredAnalysis();

    renderResult();
    const redLine = screen.getByLabelText(/detected oil level/i);
    const initialRedLineRatio = redLine.getAttribute("data-red-line-ratio");
    const slider = screen.getByRole("slider", { name: /oil level/i });

    fireEvent.keyDown(slider, { key: "ArrowDown" });

    expect(slider).toHaveAttribute("aria-valuenow", "825");
    expect(screen.getByText(/825 ml/i)).toBeInTheDocument();
    expect(screen.getByText(/675 ml/i)).toBeInTheDocument();
    expect(screen.getByText(/3 cups consumed/i)).toBeInTheDocument();
    expect(redLine).toHaveAttribute("data-red-line-ratio", initialRedLineRatio);
  });

  it("clamps the correction slider to the last full 55ml step", () => {
    setStoredAnalysis();

    renderResult();
    const slider = screen.getByRole("slider", { name: /oil level/i });

    fireEvent.keyDown(slider, { key: "End" });

    expect(slider).toHaveAttribute("aria-valuenow", "1485");
    expect(screen.getByText(/1485 ml/i)).toBeInTheDocument();
    expect(screen.getByText(/15 ml/i)).toBeInTheDocument();
  });

  it("shows an empty state when no capture exists", () => {
    sessionStorage.clear();

    renderResult();

    expect(screen.getByText(/no analyzed camera capture found/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /retake/i })).toHaveAttribute("href", "/scan?size=1.5L");
  });
});

function setStoredAnalysis() {
  sessionStorage.setItem("afia.analysis", JSON.stringify({ remainingMl: 900, redLineYRatio: 0.42 }));
}
