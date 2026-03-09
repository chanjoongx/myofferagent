"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { useLanguage } from "@/lib/i18n-context";

export default function AgentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLanguage();

  useEffect(() => {
    console.error("Agent error:", error);
  }, [error]);

  return (
    <div className="flex h-dvh items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="h-7 w-7 text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">
          {t("agentError.title")}
        </h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          {t("agentError.description")}
        </p>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-surface transition-all hover:brightness-110 active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
            {t("agentError.retry")}
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-surface-border px-5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary hover:border-accent/30"
          >
            <Home className="h-4 w-4" />
            {t("agentError.home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
