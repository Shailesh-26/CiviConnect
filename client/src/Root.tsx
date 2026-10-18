import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { NotificationProvider } from "./components/NotificationProvider";
import { ToastProvider } from "./components/ToastProvider";
import { ThemeProvider } from "./theme/ThemeProvider";

// Everything the app shares (theme, toasts, login, live notifications) wrapped around the routes.
export default function Root() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <NotificationProvider>
            <App />
          </NotificationProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
