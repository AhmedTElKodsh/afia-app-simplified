import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "../src/App";
import { I18nProvider } from "../src/i18n";
import { ThemeProvider } from "../src/theme";

function renderAt(path: string) {
  return render(
    <I18nProvider>
      <ThemeProvider>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </ThemeProvider>
    </I18nProvider>,
  );
}

describe("scan shell product identity", () => {
  it("preserves a supported 1.5L product size in the capture shell", () => {
    renderAt("/scan?size=1.5L");

    expect(screen.getByRole("heading", { name: /afia 1\.5l/i })).toBeInTheDocument();
    expect(screen.getByText(/photograph the front of the bottle/i)).toBeInTheDocument();
  });

  it("shows a pending message for the 2.5L product size", () => {
    renderAt("/scan?size=2.5L");

    expect(screen.getByRole("heading", { name: /afia 2\.5l/i })).toBeInTheDocument();
    expect(screen.getByText(/analysis for this size is pending/i)).toBeInTheDocument();
  });

  it("shows an unknown bottle size error when the size is missing", () => {
    renderAt("/scan");

    expect(screen.getByRole("heading", { name: /unknown bottle size/i })).toBeInTheDocument();
    expect(screen.getByText(/scan a valid afia qr code/i)).toBeInTheDocument();
  });

  it("shows an unknown bottle size error when the size is invalid", () => {
    renderAt("/scan?size=bad");

    expect(screen.getByRole("heading", { name: /unknown bottle size/i })).toBeInTheDocument();
    expect(screen.getByText(/this scan link does not include a supported bottle size/i)).toBeInTheDocument();
  });
});
