import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import logoSrc from "./assets/logo.png";

const link = document.querySelector("link[rel~='icon']") || document.createElement("link");
link.rel = "icon";
link.href = logoSrc;
document.head.appendChild(link);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
