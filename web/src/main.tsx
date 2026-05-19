import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { I18nProvider } from "./i18n";
import { ThemeProvider } from "./theme";
import { migrateFromOldKeys } from "./storage/sessionState";
import "./index.css";

// Consolidate legacy sessionStorage keys into single envelope (P5)
migrateFromOldKeys();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><I18nProvider><ThemeProvider>
    <BrowserRouter><App /></BrowserRouter>
  </ThemeProvider></I18nProvider></React.StrictMode>
);
