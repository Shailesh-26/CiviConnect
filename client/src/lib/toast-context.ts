import { createContext, useContext } from "react";

export type ToastKind = "success" | "error" | "info";

export type ToastOptions = {
  title?: string;
  // A button inside the toast, for example "Undo" or "Open".
  action?: { label: string; onClick: () => void };
  // How long it stays, in milliseconds.
  duration?: number;
};

export type ToastApi = {
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
};

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
