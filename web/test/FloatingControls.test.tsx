import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, afterEach } from "vitest";
import { FloatingControls } from "../src/components/FloatingControls";
import { ThemeProvider } from "../src/theme";
import { I18nProvider } from "../src/i18n";

afterEach(() => {
  localStorage.clear();
  document.documentElement.lang = "";
  document.documentElement.dir = "";
  document.documentElement.classList.remove("dark");
});

describe("FloatingControls", () => {
  it("toggles language en <-> ar and sets dir attribute", () => {
    render(<I18nProvider><ThemeProvider><FloatingControls /></ThemeProvider></I18nProvider>);
    const langBtn = screen.getByRole("button", { name: /language/i });
    expect(document.documentElement.lang).toBe("en");
    fireEvent.click(langBtn);
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("toggles theme and sets html class", () => {
    render(<I18nProvider><ThemeProvider><FloatingControls /></ThemeProvider></I18nProvider>);
    const themeBtn = screen.getByRole("button", { name: /theme/i });
    fireEvent.click(themeBtn);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
