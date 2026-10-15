import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initAntiDetection } from "./utils/obfuscation";
import { StealthMode } from "./utils/stealth";

// Inicializar protecciones anti-detección
initAntiDetection();
StealthMode.initialize();

// Delay mínimo antes de renderizar (sin interferir con funcionalidad)
const renderDelay = Math.floor(Math.random() * 50) + 10;
setTimeout(() => {
  createRoot(document.getElementById("root")!).render(<App />);
}, renderDelay);

// Activar protecciones pero sin interferir con navegación normal
StealthMode.activateEvasiveMode();
