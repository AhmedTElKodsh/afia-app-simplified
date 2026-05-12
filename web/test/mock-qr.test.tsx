import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "../src/App";
import { I18nProvider } from "../src/i18n";
import { ThemeProvider } from "../src/theme";

describe("mock QR page", () => {
  it("renders product-specific scan links for 1.5L and 2.5L bottles", () => {
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
    expect(screen.getByRole("link", { name: /scan afia 2\.5l/i })).toHaveAttribute("href", "/scan?size=2.5L");
    expect(screen.getAllByRole("img", { name: /mock qr for afia/i })).toHaveLength(2);
  });
});
