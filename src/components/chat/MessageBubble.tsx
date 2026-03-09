"use client";

import { memo, useState, useCallback } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { Bot, ArrowRightLeft, Copy, Check } from "lucide-react";
import { isSafeUrl } from "@/lib/url-utils";

interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  agentName?: string;
  isSystem?: boolean;
  timestamp?: number;
}

/* ── react-markdown 커스텀 컴포넌트 (Tailwind 스타일링) ── */

const mdComponents: Components = {
  /* ── 헤딩 ── */
  h1: ({ children }) => (
    <h2 className="mt-4 mb-2 text-base font-bold text-text-primary">{children}</h2>
  ),
  h2: ({ children }) => (
    <h3 className="mt-4 mb-1.5 text-[15px] font-semibold text-text-primary">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="mt-3 mb-1 text-sm font-semibold text-text-primary">{children}</h4>
  ),
  h4: ({ children }) => (
    <h5 className="mt-2 mb-0.5 text-sm font-medium text-text-primary">{children}</h5>
  ),

  /* ── 본문 ── */
  p: ({ children }) => (
    <p className="text-sm leading-relaxed [&:not(:first-child)]:mt-2">{children}</p>
  ),

  /* ── 리스트 ── */
  ul: ({ children }) => (
    <ul className="my-2 ml-4 list-disc space-y-1 text-sm leading-relaxed">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 ml-4 list-decimal space-y-1 text-sm leading-relaxed">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-0.5">{children}</li>,

  /* ── 인라인 서식 ── */
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,

  /* ── 링크 (XSS 검증 적용) ── */
  a: ({ href, children }) => {
    if (href && isSafeUrl(href)) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline underline-offset-2 decoration-accent/30 hover:decoration-accent transition-colors"
        >
          {children}
        </a>
      );
    }
    return <span className="text-text-secondary">{children}</span>;
  },

  /* ── 코드 (인라인 / 블록) ── */
  code: ({ className, children }) => {
    // className이 있으면 코드 펜스(``` 블록) 내부 → pre가 감싸므로 최소 스타일
    if (className) {
      return <code className={className}>{children}</code>;
    }
    // 인라인 코드
    return (
      <code className="rounded bg-surface-border/50 px-1.5 py-0.5 text-[13px] font-mono text-accent">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-surface/80 border border-surface-border p-3 text-[13px] font-mono leading-relaxed text-text-primary [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit [&>code]:text-[13px]">
      {children}
    </pre>
  ),

  /* ── 인용 / 구분선 / 테이블 ── */
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-accent/40 pl-3 text-sm italic text-text-secondary">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-surface-border" />,

  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg">
      <table className="w-max text-sm border border-surface-border">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-surface-elevated/60 text-text-secondary">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border border-surface-border px-3 py-1.5 text-left text-xs font-semibold whitespace-nowrap">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-surface-border px-3 py-1.5 text-xs">{children}</td>
  ),
};

/* ── Component ─────────────────────────────────────── */

/* ── 시간 포맷 ── */
function formatTime(ts?: number): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function MessageBubble({
  role,
  content,
  agentName,
  isSystem,
  timestamp,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
      // 클립보드 API 미지원 또는 권한 거부 시 fallback
      try {
        const ta = document.createElement("textarea");
        ta.value = content;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch { /* silent */ }
    });
  }, [content]);

  /* System / agent-switch pill */
  if (isSystem || role === "system") {
    return (
      <div className="flex justify-center py-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-surface-elevated/60 px-4 py-1.5 text-[11px] text-text-secondary backdrop-blur">
          <ArrowRightLeft className="h-3 w-3 text-accent/60" />
          {content}
        </span>
      </div>
    );
  }

  const isUser = role === "user";
  const time = formatTime(timestamp);

  // 테이블 포함 메시지는 버블 너비를 확대하여 가독성 향상
  const hasTable = !isUser && content.includes("\n|") && content.includes("---|");
  const bubbleMaxW = hasTable
    ? "max-w-[95%] sm:max-w-[90%]"
    : "max-w-[80%] sm:max-w-[70%]";

  return (
    <div
      className={`group flex ${isUser ? "justify-end" : "justify-start"} gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200`}
    >
      {/* Assistant avatar */}
      {!isUser && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 border border-accent/20">
          <Bot className="h-3.5 w-3.5 text-accent" strokeWidth={1.8} />
        </div>
      )}

      <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"} ${bubbleMaxW}`}>
        <div
          className={`w-fit ${
            isUser
              ? "rounded-2xl rounded-br-sm bg-accent text-surface px-4 py-2.5"
              : "rounded-2xl rounded-bl-sm bg-surface-elevated border border-surface-border px-4 py-3"
          }`}
        >
          {/* Agent name badge */}
          {!isUser && agentName && (
            <div className="mb-2 inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5">
              <span className="text-[11px] font-medium text-accent">{agentName}</span>
            </div>
          )}

          {/* Content */}
          <div className={`space-y-0.5 break-words ${isUser ? "text-surface" : "text-text-primary"}`}>
            {isUser ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
            ) : (
              <ReactMarkdown components={mdComponents}>{content}</ReactMarkdown>
            )}
          </div>
        </div>

        {/* Footer: timestamp + copy */}
        <div className={`flex items-center gap-2 px-1 ${isUser ? "justify-end" : "justify-start"}`}>
          {time && (
            <span className="text-[10px] text-text-secondary/40">{time}</span>
          )}
          <button
            onClick={handleCopy}
            className="md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 transition-opacity rounded p-0.5 text-text-secondary/40 hover:text-text-secondary"
            aria-label="Copy message"
          >
            {copied ? (
              <Check className="h-3 w-3 text-accent" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(MessageBubble);
