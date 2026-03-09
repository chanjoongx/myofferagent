"use client";

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react";
import { X, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useLanguage } from "@/lib/i18n-context";

/* ── Types ── */

type ToastType = "error" | "success" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
});

/* ── Provider ── */

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "error") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Toast container */}
      <div
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ── Single Toast ── */

const ICONS: Record<ToastType, typeof AlertTriangle> = {
  error: AlertTriangle,
  success: CheckCircle2,
  info: Info,
};

const STYLES: Record<ToastType, string> = {
  error: "border-red-500/30 bg-red-500/10 text-red-400",
  success: "border-accent/30 bg-accent/10 text-accent",
  info: "border-blue-500/30 bg-blue-500/10 text-blue-400",
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
  const Icon = ICONS[toast.type];
  const { t } = useLanguage();

  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  return (
    <div
      className={`pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur animate-in max-w-sm ${STYLES[toast.type]}`}
      role="alert"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="shrink-0 rounded-md p-0.5 opacity-60 hover:opacity-100 transition-opacity"
        aria-label={t("toast.close")}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ── Hook ── */

export function useToast() {
  return useContext(ToastContext);
}
