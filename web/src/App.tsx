import { Routes, Route, Navigate } from "react-router-dom";
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/scan?size=1.5L" replace />} />
      <Route path="/scan" element={<div>scan placeholder</div>} />
    </Routes>
  );
}
