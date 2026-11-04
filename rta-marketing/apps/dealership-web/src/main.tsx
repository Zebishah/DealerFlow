import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppProviders } from "./app/providers";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./brand.css";
import "./styles.css";
import "./workflow.css";
import "./experience.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Application root element was not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </AppProviders>
  </StrictMode>,
);
