"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useLanguage } from "@/lib/i18n-context";

/**
 * 라우트 단위 에러 바운더리.
 *
 * 이 파일은 **루트 레이아웃이 살아 있을 때**만 렌더됩니다. 그래서 여기서는
 * LanguageProvider가 그대로 있어 t()를 쓸 수 있습니다.
 * (레이아웃 자체가 터지는 경우는 global-error.tsx가 받습니다 — 거기서는
 *  프로바이더가 없어서 t()를 쓸 수 없고, 실제로 키 문자열이 그대로 보입니다.)
 *
 * 예전 이름이 `GlobalError`라 global-error.tsx인 줄 알기 쉬웠습니다.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLanguage();

  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="h-7 w-7 text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">
          {t("error.title")}
        </h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          {t("error.description")}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-surface transition-all hover:brightness-110 active:scale-95"
        >
          <RotateCcw className="h-4 w-4" />
          {t("error.retry")}
        </button>
        {/* 서버에서 난 에러는 메시지가 클라이언트로 오지 않습니다.
            digest만이 서버 로그와 이어 붙일 수 있는 유일한 단서입니다. */}
        {error.digest && (
          <code className="text-[11px] font-mono text-text-secondary">
            {error.digest}
          </code>
        )}
      </div>
    </div>
  );
}
