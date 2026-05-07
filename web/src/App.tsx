import { Routes, Route, Navigate } from "react-router-dom";
import { FloatingControls } from "./components/FloatingControls";

export default function App() {
  return (
    <>
      <FloatingControls />
      <Routes>
        <Route path="/" element={<Navigate to="/scan?size=1.5L" replace />} />
        <Route path="/scan" element={<div>scan placeholder</div>} />
      </Routes>
    </>
  );
}
