import { Routes, Route, Navigate } from "react-router-dom";
import { DEFAULT_BOTTLE_SIZE } from "@afia/shared";
import { AdminShell } from "./components/AdminShell";
import { FloatingControls } from "./components/FloatingControls";
import { MockQrPage } from "./components/MockQrPage";
import { ResultShell } from "./components/ResultShell";
import { ScanShell } from "./components/ScanShell";

export default function App() {
  return (
    <>
      <FloatingControls />
      <Routes>
        <Route path="/" element={<Navigate to={`/scan?size=${DEFAULT_BOTTLE_SIZE}`} replace />} />
        <Route path="/mock-qr" element={<MockQrPage />} />
        <Route path="/scan" element={<ScanShell />} />
        <Route path="/result" element={<ResultShell />} />
        <Route path="/admin" element={<AdminShell />} />
      </Routes>
    </>
  );
}
