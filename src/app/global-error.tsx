"use client";

/**
 * 최후의 에러 바운더리
 * ------------------------------------------------------------------
 * 루트 레이아웃 **자체**가 렌더 중 터지면 (프로바이더, 폰트 로더, 인라인
 * 스크립트 등) `error.tsx`는 그 레이아웃 안에 있으므로 같이 죽습니다.
 * 그 경우 Next는 이 파일을 찾고, 없으면 자기 기본 오류 화면을 띄웁니다
 * — 영어로 된, 브랜드도 없는 흰 화면입니다.
 *
 * 그래서 이 컴포넌트는 **렌더 트리에 아무것도 의존하지 않습니다**:
 *  - Context 없음 (프로바이더가 죽은 상황이라 useLanguage를 쓸 수 없습니다.
 *    쓰면 기본 컨텍스트로 떨어져 'error.title' 같은 키가 그대로 보입니다.)
 *  - Tailwind 클래스 없음 (CSS가 로드되지 않았을 수 있습니다 — 인라인 스타일)
 *  - 아이콘 라이브러리 없음 (인라인 SVG)
 *
 * 언어만은 prefs-store에서 읽습니다. 프로바이더가 아니라 컨텍스트 없는
 * 순수 모듈이라 레이아웃이 죽어도 멀쩡하고, 덕분에 오류 화면도
 * 사용자가 고른 언어로 나옵니다.
 *
 * `<html>`과 `<body>`를 직접 렌더해야 합니다. 죽은 레이아웃을 대체하기 때문입니다.
 */

import { useEffect, useSyncExternalStore } from "react";
import {
  subscribeLocale,
  getLocaleSnapshot,
  getLocaleServerSnapshot,
} from "@/lib/prefs-store";

const COPY = {
  ko: {
    title: "문제가 발생했습니다",
    body: "페이지를 불러오는 중 예기치 못한 오류가 났습니다. 새로고침하면 대부분 해결됩니다.",
    retry: "다시 시도",
  },
  en: {
    title: "Something went wrong",
    body: "An unexpected error occurred while loading this page. Reloading usually fixes it.",
    retry: "Try again",
  },
} as const;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  /* 서버 스냅샷은 'ko'(앱 기본값)로 고정됩니다. 오류 화면에서 하이드레이션
   * 불일치까지 내면 화면 자체를 못 띄우게 되므로 여기가 특히 중요합니다. */
  const lang = useSyncExternalStore(
    subscribeLocale,
    getLocaleSnapshot,
    getLocaleServerSnapshot,
  );

  useEffect(() => {
    console.error("Global error (root layout):", error);
  }, [error]);

  const c = COPY[lang];

  return (
    <html lang={lang}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          background: "#0a0a0f",
          color: "#ededf2",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
            maxWidth: "28rem",
            textAlign: "center",
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#f87171"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>
            {c.title}
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              lineHeight: 1.6,
              color: "#9a9aa8",
              margin: 0,
            }}
          >
            {c.body}
          </p>
          <button
            onClick={reset}
            style={{
              border: "none",
              borderRadius: "0.75rem",
              background: "#14b8a6",
              color: "#0a0a0f",
              padding: "0.625rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {c.retry}
          </button>
          {error.digest && (
            <code style={{ fontSize: "0.6875rem", color: "#6b6b78" }}>
              {error.digest}
            </code>
          )}
        </div>
      </body>
    </html>
  );
}
