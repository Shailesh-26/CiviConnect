import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { installMotion } from "./lib/motion";
import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { NotificationProvider } from "./components/NotificationProvider";
import { ToastProvider } from "./components/ToastProvider";
import { ThemeProvider } from "./theme/ThemeProvider";

installMotion();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <NotificationProvider>
              <App />
            </NotificationProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
