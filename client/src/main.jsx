import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/theme.css";
import "./prefs"; // ตั้ง data-motion ที่ <html> ก่อน React วาดหน้าแรก

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
