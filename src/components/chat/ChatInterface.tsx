"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { Paperclip, ArrowUp, FileText, X, Download, Printer, RotateCcw } from "lucide-react";
import MessageBubble from "./MessageBubble";
import AgentStatusPanel from "./AgentStatusPanel";
import ATSScoreCard from "@/components/resume/ATSScoreCard";
import JobCard from "@/components/jobs/JobCard";
import { extractTextFromPDF, preloadPdfJs } from "@/components/pdf-loader";
import { useLanguage } from "@/lib/i18n-context";
import { useToast } from "@/components/ui/Toast";
import { AGENT_NAMES } from "@/lib/agents/constants";
import type {
  AgentResponse,
  StructuredData,
  MatchAnalysis,
} from "@/lib/types";

/* ── 타입 ──────────────────────────────────── */

interface GeneratedFile {
  type: string;
  content: string;
  fileName: string;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  agentName?: string;
  structuredData?: StructuredData;
  generatedFiles?: GeneratedFile[];
  attachedFileName?: string;
  timestamp?: number;
  isError?: boolean;
}

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ── Match 분석 인라인 렌더 ────────────────── */

function MatchResultCard({ data }: { data: MatchAnalysis }) {
  const { t } = useLanguage();

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-elevated p-5 space-y-5">
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center">
          <span className="text-3xl font-bold">{data.matchScore}</span>
          <span className="text-xs text-text-secondary">/100</span>
        </div>
        <div>
          <h3 className="text-base font-semibold">{t("match.title")}</h3>
          <p className="text-xs text-text-secondary">{t("match.subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <h4 className="text-xs font-medium text-text-secondary mb-2">
            {t("match.matchedKeywords")}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {data.keywordGap.matched.map((kw) => (
              <span
                key={kw}
                className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] text-emerald-400"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-medium text-text-secondary mb-2">
            {t("match.missingKeywords")}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {data.keywordGap.missing.map((kw) => (
              <span
                key={kw}
                className="rounded-full bg-orange-500/15 px-2.5 py-0.5 text-[11px] text-orange-400"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>{t("match.requiredSkills")}</span>
          <span className="font-mono text-accent">
            {data.skillMatch.required.percentage}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-border overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${data.skillMatch.required.percentage}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>{t("match.preferredSkills")}</span>
          <span className="font-mono text-accent">
            {data.skillMatch.preferred.percentage}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-border overflow-hidden">
          <div
            className="h-full rounded-full bg-accent/70 transition-all duration-500"
            style={{ width: `${data.skillMatch.preferred.percentage}%` }}
          />
        </div>
      </div>

      {data.resumeEdits.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-text-secondary mb-2">
            {t("match.suggestedEdits")}
          </h4>
          <div className="space-y-2">
            {data.resumeEdits.map((edit, i) => (
              <div
                key={i}
                className="rounded-lg bg-surface/60 border border-surface-border p-3 text-xs space-y-1"
              >
                <span className="font-medium text-accent">{edit.section}</span>
                <p className="text-text-secondary line-through">
                  {edit.original}
                </p>
                <p className="text-text-primary">{edit.suggested}</p>
                <p className="text-text-secondary italic">{edit.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 다운로드 헬퍼 ─────────────────────────── */

function downloadAsFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function extractResumeContent(content: string): string | null {
  const codeBlock = content.match(/```(?:markdown|md)?\n([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();
  const resumeHeaders = ["## Education", "## Experience", "## Skills", "## Projects"];
  const hasResumeStructure = resumeHeaders.filter((h) => content.includes(h)).length >= 2;
  if (hasResumeStructure) return content.trim();
  return null;
}

/* ── 마크다운 → HTML 변환 (이력서 인쇄용, 경량) ── */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function markdownToHtml(md: string): string {
  // Strip any raw HTML tags before markdown processing
  const sanitized = md.replace(/<[^>]*>/g, '');
  return sanitized
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/^---$/gm, '<hr/>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
      try {
        const u = new URL(url);
        if (u.protocol === 'http:' || u.protocol === 'https:') {
          return `<a href="${escapeHtml(url)}">${escapeHtml(text)}</a>`;
        }
      } catch { /* invalid URL */ }
      return escapeHtml(text);
    })
    .replace(/^(?!<[hulo]|<li|<hr)(.*\S.*)$/gm, '<p>$1</p>')
    .replace(/\n{2,}/g, '\n');
}

function printResumeAsPdf(markdownContent: string) {
  const html = markdownToHtml(markdownContent);
  const win = window.open('', '_blank');
  if (!win) return;

  win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Resume</title>
<style>
  @page { margin: 0.7in 0.8in; size: letter; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
  h1 { font-size: 18pt; margin-bottom: 4pt; }
  h2 { font-size: 12pt; border-bottom: 1px solid #333; padding-bottom: 2pt; margin: 14pt 0 6pt; text-transform: uppercase; letter-spacing: 0.5pt; }
  h3 { font-size: 11pt; margin: 8pt 0 2pt; }
  p { margin: 2pt 0; }
  ul { margin: 2pt 0 2pt 18pt; }
  li { margin: 1pt 0; }
  hr { border: none; border-top: 1px solid #ccc; margin: 8pt 0; }
  a { color: #1a1a1a; text-decoration: none; }
  strong { font-weight: 700; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head><body>${html}</body></html>`);
  win.document.close();
  setTimeout(() => { win.print(); win.onafterprint = () => win.close(); }, 300);
}

/* ── 파일 다운로드 블록 ────────────────────── */

function GeneratedFilesBlock({ files }: { files: GeneratedFile[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {files.map((f) => (
        <div key={f.fileName} className="flex gap-1.5">
          <button
            onClick={() => downloadAsFile(f.content, f.fileName, "text/plain;charset=utf-8")}
            className="inline-flex items-center gap-2 rounded-xl border border-surface-border bg-surface-elevated px-3.5 py-2 text-xs transition-colors hover:border-accent/40 hover:bg-accent/5"
          >
            <Download className="h-3.5 w-3.5 text-accent" />
            <span className="font-medium">{f.fileName}</span>
          </button>
          {f.type === "resume_markdown" && (
            <button
              onClick={() => printResumeAsPdf(f.content)}
              className="inline-flex items-center gap-2 rounded-xl border border-surface-border bg-surface-elevated px-3.5 py-2 text-xs transition-colors hover:border-accent/40 hover:bg-accent/5"
            >
              <Printer className="h-3.5 w-3.5 text-accent" />
              <span className="font-medium">PDF</span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function MarkdownDownloadButton({ label, content }: { label: string; content: string }) {
  const resumeContent = extractResumeContent(content);
  if (!resumeContent) return null;
  const timestamp = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex gap-2">
      <button
        onClick={() => downloadAsFile(resumeContent, `resume_${timestamp}.md`, "text/markdown;charset=utf-8")}
        className="inline-flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3.5 py-2 text-xs text-accent transition-colors hover:bg-accent/10"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="font-medium">{label}</span>
      </button>
      <button
        onClick={() => printResumeAsPdf(resumeContent)}
        className="inline-flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3.5 py-2 text-xs text-accent transition-colors hover:bg-accent/10"
      >
        <Printer className="h-3.5 w-3.5" />
        <span className="font-medium">PDF</span>
      </button>
    </div>
  );
}

/* ── 구조화 데이터 렌더 분기 ───────────────── */

function StructuredDataBlock({ data }: { data: StructuredData }) {
  if (!data) return null;
  switch (data.type) {
    case "ats_analysis":
      return <ATSScoreCard analysis={data.data} />;
    case "job_results":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.data.map((job, idx) => (
            <JobCard key={`${job.company}-${idx}`} job={job} />
          ))}
        </div>
      );
    case "match_analysis":
      return <MatchResultCard data={data.data} />;
    default:
      return null;
  }
}

/* ── 상수 ─────────────────────────────────── */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEXTAREA_HEIGHT = 160;
const MAX_RENDERED_MESSAGES = 100;       // 렌더링할 최대 메시지 수
const SEND_COOLDOWN_MS = 1_500;          // 전송 간 최소 간격 (레이트 리미팅)

/* ── 메인 컴포넌트 ─────────────────────────── */

export default function ChatInterface() {
  const { locale, t } = useLanguage();
  const { toast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentAgent, setCurrentAgent] = useState<string>(AGENT_NAMES.TRIAGE);
  const [completedAgents, setCompletedAgents] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<string | null>(null);
  const [lastResponseId, setLastResponseId] = useState<string | null>(null);

  const sessionIdRef = useRef(generateSessionId());
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevLocaleRef = useRef(locale);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSendTimeRef = useRef(0);
  const resizeRafRef = useRef<number>(0);

  // 언마운트 시 진행 중인 요청 취소
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      cancelAnimationFrame(resizeRafRef.current);
    };
  }, []);

  // PDF.js 프리로드 — 브라우저 idle 시점에 백그라운드 로딩
  useEffect(() => {
    preloadPdfJs();
  }, []);

  // 모바일 키보드 뷰포트 대응 — 컨테이너 높이를 visualViewport에 맞춤
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const root = scrollRef.current?.closest<HTMLDivElement>("[data-chat-root]");
    if (!root) return;

    const onResize = () => {
      // 키보드가 열리면 visualViewport.height가 줄어듬
      // 컨테이너 높이를 실제 보이는 영역에 맞춤
      root.style.height = `${vv.height}px`;
      // 스크롤 위치를 최하단으로 유지
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "instant",
        });
      });
    };

    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, []);

  // 로케일 변경 시 전체 대화 리셋 (이전 대화는 다른 언어이므로)
  useEffect(() => {
    if (prevLocaleRef.current !== locale) {
      prevLocaleRef.current = locale;
      sessionIdRef.current = generateSessionId();
      setCurrentAgent(AGENT_NAMES.TRIAGE);
      setCompletedAgents([]);
      setLastResponseId(null);
      setResumeText(null);
      setAttachedFile(null);
      setInput("");
    }

    setMessages([
      {
        role: "assistant",
        content: t("chat.welcome"),
        agentName: AGENT_NAMES.TRIAGE,
      },
    ]);
  }, [locale, t]);

  // 자동 스크롤
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  // 메시지 가상화 — 최근 N개만 렌더링 (성능 최적화)
  const visibleMessages = useMemo(() => {
    if (messages.length <= MAX_RENDERED_MESSAGES) return messages;
    return messages.slice(-MAX_RENDERED_MESSAGES);
  }, [messages]);

  // assistant 메시지에서 이력서 마크다운 존재 여부를 캐시 (매 렌더링마다 regex 반복 실행 방지)
  const resumeContentMap = useMemo(() => {
    const map = new Map<number, string | null>();
    visibleMessages.forEach((msg, idx) => {
      if (msg.role === "assistant" && !msg.generatedFiles) {
        map.set(idx, extractResumeContent(msg.content));
      }
    });
    return map;
  }, [visibleMessages]);

  const handleAgentSwitch = useCallback(
    (newAgent: string) => {
      if (newAgent !== currentAgent) {
        setCompletedAgents((prev) =>
          prev.includes(currentAgent) ? prev : [...prev, currentAgent]
        );
        setMessages((prev) => [
          ...prev,
          { role: "system", content: t("chat.agentSwitch", { agent: newAgent }) },
        ]);
        setCurrentAgent(newAgent);
      }
    },
    [currentAgent, t]
  );

  /** 사이드바 클릭으로 수동 에이전트 전환 — lastResponseId를 리셋하여 새 대화 시작 */
  const handleManualAgentSwitch = useCallback(
    (targetAgent: string) => {
      if (targetAgent === currentAgent || isLoading) return;
      setLastResponseId(null);
      handleAgentSwitch(targetAgent);
    },
    [currentAgent, isLoading, handleAgentSwitch]
  );

  /** 새 대화 시작 — 모든 상태 초기화 */
  const handleNewConversation = useCallback(() => {
    if (isLoading) return;
    abortControllerRef.current?.abort();
    sessionIdRef.current = generateSessionId();
    setCurrentAgent(AGENT_NAMES.TRIAGE);
    setCompletedAgents([]);
    setLastResponseId(null);
    setResumeText(null);
    setAttachedFile(null);
    setInput("");
    setMessages([
      {
        role: "assistant",
        content: t("chat.welcome"),
        agentName: AGENT_NAMES.TRIAGE,
        timestamp: Date.now(),
      },
    ]);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [isLoading, t]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    const hasResume = !!resumeText;
    if ((!trimmed && !hasResume) || isLoading) return;

    // 클라이언트 레이트 리미팅 — 연속 빠른 전송 방지
    const now = Date.now();
    if (now - lastSendTimeRef.current < SEND_COOLDOWN_MS) {
      return;
    }
    lastSendTimeRef.current = now;

    const messageText = trimmed || t("chat.analyzeAuto");

    const userMsg: ChatMessage = {
      role: "user",
      content: messageText,
      timestamp: Date.now(),
      ...(attachedFile ? { attachedFileName: attachedFile } : {}),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const capturedResumeText = resumeText;
    setAttachedFile(null);
    setResumeText(null);

    try {
      // 이전 요청이 진행 중이면 취소
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const apiMessages = [...messages, userMsg]
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: apiMessages,
          sessionId: sessionIdRef.current,
          ...(capturedResumeText ? { resumeText: capturedResumeText } : {}),
          ...(lastResponseId ? { lastResponseId } : {}),
          ...(currentAgent ? { activeAgentName: currentAgent } : {}),
          language: locale,
        }),
      });

      if (!res.ok) throw new Error(`API ${res.status}`);

      const json: AgentResponse = await res.json();

      if (json.lastResponseId) {
        setLastResponseId(json.lastResponseId);
      }

      if (json.activeAgent !== currentAgent) {
        handleAgentSwitch(json.activeAgent);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: json.output,
          agentName: json.activeAgent,
          timestamp: Date.now(),
          structuredData: json.structuredData ?? undefined,
          generatedFiles:
            json.generatedFiles && json.generatedFiles.length > 0
              ? json.generatedFiles
              : undefined,
        },
      ]);
    } catch (err) {
      // AbortError는 의도적 취소이므로 에러 메시지 표시하지 않음
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: "system", content: t("chat.error"), isError: true },
      ]);
    } finally {
      setIsLoading(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [input, isLoading, messages, currentAgent, resumeText, attachedFile, lastResponseId, locale, t, handleAgentSwitch]);

  /** 에러 발생 시 마지막 유저 메시지를 재전송 */
  const handleRetry = useCallback(() => {
    if (isLoading) return;
    // 마지막 에러 시스템 메시지 제거, 마지막 유저 메시지 찾기
    setMessages((prev) => {
      const cleaned = prev.filter((m, i) => !(i === prev.length - 1 && m.isError));
      return cleaned;
    });
    // 마지막 유저 메시지의 content를 input에 넣고 재전송
    const lastUserMsg = messages.filter((m) => m.role === "user").pop();
    if (lastUserMsg) {
      setInput(lastUserMsg.content);
      // 다음 틱에서 sendMessage 호출 (input state 반영 후)
      requestAnimationFrame(() => {
        const sendBtn = document.querySelector<HTMLButtonElement>('[aria-label="' + t("chat.send") + '"]');
        sendBtn?.click();
      });
    }
  }, [isLoading, messages, t]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() || resumeText) sendMessage();
    }
  };

  // Textarea 리사이즈를 rAF로 디바운스 — 매 키 입력마다 reflow 방지
  const handleTextareaChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    cancelAnimationFrame(resizeRafRef.current);
    resizeRafRef.current = requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT) + "px";
    });
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast(t("chat.fileSizeError"), "error");
      return;
    }

    try {
      const text = await extractTextFromPDF(file);
      setResumeText(text);
      setAttachedFile(file.name);
    } catch (err) {
      console.error("PDF parse failed:", err);
      toast(t("chat.pdfError"), "error");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div data-chat-root className="flex h-full flex-col md:flex-row overflow-hidden">
      {/* Sidebar */}
      <aside className="w-full md:w-60 lg:w-64 shrink-0 border-b md:border-b-0 md:border-r border-surface-border glass">
        <AgentStatusPanel
          currentAgent={currentAgent}
          completedAgents={completedAgents}
          onAgentSelect={handleManualAgentSwitch}
          onNewConversation={handleNewConversation}
          isLoading={isLoading}
        />
      </aside>

      {/* Chat Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Messages */}
        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-label={t("chat.messageList")}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar"
        >
          {/* 메시지 수 초과 시 안내 */}
          {messages.length > MAX_RENDERED_MESSAGES && (
            <div className="flex justify-center py-2">
              <span className="text-[11px] text-text-secondary/60">
                {t("chat.olderHidden", {
                  count: String(messages.length - MAX_RENDERED_MESSAGES),
                })}
              </span>
            </div>
          )}

          {visibleMessages.map((msg, idx) => (
            <div key={idx} className="space-y-3">
              {/* Attachment card */}
              {msg.attachedFileName && msg.role === "user" && (
                <div className="flex justify-end">
                  <div className="inline-flex items-center gap-2.5 rounded-2xl rounded-br-md bg-accent/8 border border-accent/20 px-4 py-2.5">
                    <FileText className="h-4 w-4 text-accent" />
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-accent">
                        {msg.attachedFileName}
                      </span>
                      <span className="text-[10px] text-text-secondary">
                        {t("chat.pdfLabel")}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Structured data (score card etc.) BEFORE text */}
              {msg.structuredData && (
                <div className="max-w-[90%] sm:max-w-[80%]">
                  <StructuredDataBlock data={msg.structuredData} />
                </div>
              )}

              <MessageBubble
                role={msg.role}
                content={msg.content}
                agentName={msg.agentName}
                isSystem={msg.role === "system"}
                timestamp={msg.timestamp}
              />

              {/* 에러 시 재시도 버튼 */}
              {msg.isError && (
                <div className="flex justify-center">
                  <button
                    onClick={handleRetry}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-surface-elevated px-3.5 py-1.5 text-[11px] text-text-secondary transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-40"
                  >
                    <RotateCcw className="h-3 w-3" />
                    {t("chat.retry")}
                  </button>
                </div>
              )}

              {msg.generatedFiles && (
                <div className="max-w-[90%] sm:max-w-[80%]">
                  <GeneratedFilesBlock files={msg.generatedFiles} />
                </div>
              )}
              {msg.role === "assistant" && !msg.generatedFiles && resumeContentMap.get(idx) && (
                <div className="max-w-[90%] sm:max-w-[80%]">
                  <MarkdownDownloadButton
                    label={t("chat.downloadResume")}
                    content={msg.content}
                  />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start" role="status" aria-label={t("chat.loading")}>
              <div className="rounded-2xl rounded-bl-md bg-surface-elevated border border-surface-border px-5 py-3.5">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-text-secondary/60 animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-text-secondary/60 animate-bounce [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-text-secondary/60 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input area — chat-input-area 클래스로 모바일 키보드 대응 */}
        <div className="chat-input-area border-t border-surface-border bg-surface/80 backdrop-blur px-4 py-3">
          {attachedFile && (
            <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-accent/8 border border-accent/20 px-3 py-1.5 text-xs text-accent">
              <FileText className="h-3.5 w-3.5" />
              <span className="font-medium">{attachedFile}</span>
              <button
                onClick={() => {
                  setAttachedFile(null);
                  setResumeText(null);
                }}
                className="ml-1 rounded-md p-0.5 hover:bg-accent/10 transition-colors"
                aria-label={t("chat.removeFile")}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary hover:border-accent/30"
              title={t("chat.pdfTooltip")}
              aria-label={t("chat.pdfTooltip")}
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={onKeyDown}
              placeholder={t("chat.placeholder")}
              aria-label={t("chat.placeholder")}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-surface-border bg-surface-elevated px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 outline-none transition-colors focus:border-accent/40 focus:ring-1 focus:ring-accent/20"
            />

            <button
              onClick={sendMessage}
              disabled={isLoading || (!input.trim() && !resumeText)}
              className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-surface transition-all hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
              aria-label={t("chat.send")}
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
