import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "../src/App";
import { I18nProvider } from "../src/i18n";
import { ThemeProvider } from "../src/theme";

describe("mock QR page", () => {
  it("renders the 1.5L scan link and keeps 2.5L as mock-only identity", () => {
    render(
      <I18nProvider>
        <ThemeProvider>
          <MemoryRouter initialEntries={["/mock-qr"]}>
            <App />
          </MemoryRouter>
        </ThemeProvider>
      </I18nProvider>,
    );

    expect(screen.getByRole("link", { name: /scan afia 1\.5l/i })).toHaveAttribute("href", "/scan?size=1.5L");
    expect(screen.queryByRole("link", { name: /scan afia 2\.5l/i })).not.toBeInTheDocument();
    expect(screen.getByText(/mock qr only\. 2\.5l scan flow is delayed/i)).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /mock qr for afia/i })).toHaveLength(2);
  });
});
