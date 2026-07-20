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

/**
 * 동시에 보여 줄 최대 개수.
 *
 * 예전에는 제한이 없어서, 스트리밍이 연속으로 실패하면 토스트가 계속 쌓여
 * 화면 아래로 넘쳐 흘렀습니다 (가장 **최근** 것이 화면 밖으로 밀려나는,
 * 정확히 반대로 동작하는 상황). 오래된 것부터 밀어냅니다.
 */
const MAX_TOASTS = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "error") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }].slice(-MAX_TOASTS));
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Toast container */}
      {/*
        컨테이너는 라이브 영역이 **아닙니다**.
        예전에는 여기 role="status"(= aria-live polite)가 있고 각 토스트에도
        role="alert"(= assertive)가 있어 라이브 영역이 중첩됐습니다. 중첩은
        명세상 동작이 정의돼 있지 않아 스크린 리더가 두 번 읽거나 아예
        읽지 않았습니다. 이제 각 토스트가 자기 자신의 라이브 영역입니다.
      */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
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
      /* 오류만 즉시 끼어들고(assertive), 성공·안내는 하던 말이 끝난 뒤 읽힙니다. */
      role={toast.type === "error" ? "alert" : "status"}
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
