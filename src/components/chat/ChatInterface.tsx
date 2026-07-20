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
import { Paperclip, ArrowUp, FileText, X, RotateCcw, Square, PanelRight } from "lucide-react";
import MessageBubble from "./MessageBubble";
import AgentStatusPanel from "./AgentStatusPanel";
import ATSScoreCard from "@/components/resume/ATSScoreCard";
import ResumePanel from "@/components/resume/ResumePanel";
import JobCard from "@/components/jobs/JobCard";
import { extractTextFromPDF, preloadPdfJs } from "@/components/pdf-loader";
import { useLanguage } from "@/lib/i18n-context";
import { useMediaQuery, useModalOverlay, MOBILE_QUERY } from "@/lib/use-modal-overlay";
import { useToast } from "@/components/ui/Toast";
import { useResume } from "@/lib/resume/use-resume";
import { streamAgent } from "@/lib/agent-client";
import { AGENT_NAMES } from "@/lib/agents/constants";
import { MAX_HISTORY_MESSAGES, type StructuredData, type MatchAnalysis } from "@/lib/types";
import type { ResumeDocument } from "@/lib/resume/schema";

/* ── 타입 ──────────────────────────────────── */

interface ChatMessage {
  /**
   * 안정적인 식별자.
   *
   * 스트리밍 대상 말풍선을 "배열의 마지막 요소"로 찾으면 안 됩니다.
   * 핸드오프가 일어나면 그 사이에 시스템 메시지가 배열 끝에 추가되어
   * 이후 델타가 전부 엉뚱한 곳을 향하거나 통째로 버려집니다.
   * (실제로 PDF 첨부 시 첫 프레임이 곧바로 에이전트 전환이라
   *  응답이 한 글자도 표시되지 않는 버그가 있었습니다.)
   */
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  agentName?: string;
  structuredData?: StructuredData[];
  attachedFileName?: string;
  timestamp?: number;
  isError?: boolean;
  /** 스트리밍 중 — 커서 표시용 */
  streaming?: boolean;
}

let messageSeq = 0;
function nextMessageId(): string {
  return `m${++messageSeq}`;
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
            {data.keywordGap.matched.map((kw, i) => (
              <span
                key={`${kw}-${i}`}
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
            {data.keywordGap.missing.map((kw, i) => (
              <span
                key={`${kw}-${i}`}
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
                <p className="text-text-secondary line-through">{edit.original}</p>
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

/* ── 도구 이름 → 상태 문구 ─────────────────── */

function toolStatusKey(tool: string): string {
  if (tool.includes("search")) return "status.searching";
  if (tool.includes("ats")) return "status.analyzing";
  if (tool.includes("import")) return "status.importing";
  if (/^(set_|upsert_|remove_|improve_)/.test(tool)) return "status.writing";
  return "status.working";
}

/* ── 상수 ─────────────────────────────────── */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEXTAREA_HEIGHT = 160;
const MAX_RENDERED_MESSAGES = 100;
const SEND_COOLDOWN_MS = 1_000;

/* ── 메인 컴포넌트 ─────────────────────────── */

export default function ChatInterface() {
  const { locale, t } = useLanguage();
  const { toast } = useToast();
  const resume = useResume();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentAgent, setCurrentAgent] = useState<string>(AGENT_NAMES.TRIAGE);
  const [completedAgents, setCompletedAgents] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusKey, setStatusKey] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<string | null>(null);
  const [lastResponseId, setLastResponseId] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  /* 패널은 모바일에서만 오버레이입니다. 데스크톱에서는 나란히 놓인 컬럼이라
   * 포커스 트랩·Escape 닫기·스크롤 잠금을 걸면 오히려 방해가 됩니다. */
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const panelIsModal = panelOpen && isMobile;
  const closePanel = useCallback(() => setPanelOpen(false), []);
  useModalOverlay(panelIsModal, panelRef, closePanel);

  const currentAgentRef = useRef<string>(AGENT_NAMES.TRIAGE);
  /** 지금 스트리밍 중인 assistant 말풍선의 id */
  const streamingIdRef = useRef<string | null>(null);
  /** 마지막으로 보낸 내용 — 재시도가 첨부 파일까지 그대로 복원하도록 보관 */
  const lastSendRef = useRef<{ text: string; resumeText: string | null; fileName: string | null } | null>(null);
  /** 요청을 보낼 때의 이력서 — 응답을 3-way 병합할 기준점 */
  const sentDocRef = useRef<ResumeDocument | null>(null);
  const sessionIdRef = useRef(generateSessionId());
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevLocaleRef = useRef(locale);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSendTimeRef = useRef(0);
  const resizeRafRef = useRef<number>(0);
  const fullHeightRef = useRef(0);

  /* 스트리밍 델타 버퍼 —
     토큰마다 setState하면 ReactMarkdown이 매번 재파싱되어 버벅입니다.
     ref에 모았다가 애니메이션 프레임마다 한 번씩 반영합니다. */
  const deltaBufferRef = useRef("");
  const flushRafRef = useRef<number>(0);

  /**
   * 스트리밍 상태를 완전히 정리한다.
   *
   * 버퍼를 비우지 않으면 **이전 턴의 텍스트가 다음 턴에 새어 나옵니다.**
   * (중지 직후 남아 있던 rAF가 뒤늦게 실행되거나, 백그라운드 탭에서 rAF가
   *  지연됐다가 새 턴이 시작된 뒤에 발화하는 경우)
   */
  const endStreaming = useCallback(() => {
    cancelAnimationFrame(flushRafRef.current);
    deltaBufferRef.current = "";
    streamingIdRef.current = null;
  }, []);

  /** 대화 리셋 시 에이전트를 Triage로 되돌린다 (ref까지 함께 갱신) */
  const resetAgent = useCallback(() => {
    currentAgentRef.current = AGENT_NAMES.TRIAGE;
    setCurrentAgent(AGENT_NAMES.TRIAGE);
    setCompletedAgents([]);
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      cancelAnimationFrame(resizeRafRef.current);
      cancelAnimationFrame(flushRafRef.current);
    };
  }, []);

  useEffect(() => {
    preloadPdfJs();
  }, []);

  // 모바일 키보드 뷰포트 대응 (--vh 갱신)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let rafId = 0;
    let prevHeight = 0;
    fullHeightRef.current = vv.height;

    const syncVh = () => {
      const h = vv.height;
      if (h === prevHeight) return;
      prevHeight = h;

      if (h > fullHeightRef.current) fullHeightRef.current = h;
      setKeyboardOpen(h < fullHeightRef.current * 0.75);

      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        document.documentElement.style.setProperty("--vh", `${h * 0.01}px`);
        if (vv.offsetTop > 0) window.scrollTo(0, 0);
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "instant",
        });
      });
    };

    syncVh();
    vv.addEventListener("resize", syncVh);
    vv.addEventListener("scroll", syncVh);

    return () => {
      vv.removeEventListener("resize", syncVh);
      vv.removeEventListener("scroll", syncVh);
      cancelAnimationFrame(rafId);
      document.documentElement.style.removeProperty("--vh");
    };
  }, []);

  // 로케일 변경 시 대화 리셋 (이력서 정본은 언어와 무관하므로 유지)
  useEffect(() => {
    if (prevLocaleRef.current !== locale) {
      prevLocaleRef.current = locale;
      /* 진행 중인 스트림을 반드시 끊습니다. 끊지 않으면 이전 대화의 응답이
       * 리셋 뒤에 도착해 onAgent가 새 대화에 전환 메시지를 끼워 넣고,
       * onDone이 방금 비운 lastResponseId를 이전 대화의 체인 값으로
       * 되살립니다 — 새 대화가 이전 언어의 맥락 위에서 이어지게 됩니다. */
      abortControllerRef.current?.abort();
      endStreaming();
      setIsLoading(false);
      setStatusKey(null);
      sessionIdRef.current = generateSessionId();
      resetAgent();
      setLastResponseId(null);
      setResumeText(null);
      setAttachedFile(null);
      setInput("");
    }

    setMessages([
      {
        id: nextMessageId(),
        role: "assistant",
        content: t("chat.welcome"),
        agentName: AGENT_NAMES.TRIAGE,
      },
    ]);
  }, [locale, t, resetAgent, endStreaming]);

  // 자동 스크롤
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    });
    return () => cancelAnimationFrame(id);
  }, [messages, isLoading]);

  const visibleMessages = useMemo(() => {
    if (messages.length <= MAX_RENDERED_MESSAGES) return messages;
    return messages.slice(-MAX_RENDERED_MESSAGES);
  }, [messages]);

  /**
   * 활성 에이전트 전환.
   *
   * 비교 기준을 state가 아니라 **ref**로 둡니다. 한 번의 스트림에서 핸드오프가
   * 연달아 일어날 수 있는데(Triage → Scout → Match), state는 다음 렌더까지
   * 갱신되지 않아 두 번째 전환이 낡은 값과 비교됩니다.
   * ref는 동기적으로 갱신되므로 연속 전환이 정확히 처리됩니다.
   *
   * (setState 업데이터 안에서 다른 setState를 호출하면 안 됩니다 —
   *  업데이터는 순수해야 하고 React가 두 번 호출할 수 있어 시스템 메시지가
   *  중복 삽입됩니다.)
   */
  const handleAgentSwitch = useCallback(
    (newAgent: string) => {
      const prev = currentAgentRef.current;
      if (newAgent === prev) return;
      currentAgentRef.current = newAgent;

      /* 여기서는 완료 처리를 하지 않습니다.
       * 전환했다는 사실은 이전 에이전트가 **무언가 해냈다**는 뜻이 아닙니다.
       * 완료 여부는 서버가 실제 도구 실행을 보고 `payload.completedAgents`로
       * 알려줍니다. */
      setMessages((msgs) => [
        ...msgs,
        { id: nextMessageId(), role: "system", content: t("chat.agentSwitch", { agent: newAgent }) },
      ]);
      setCurrentAgent(newAgent);
    },
    [t],
  );


  const handleManualAgentSwitch = useCallback(
    (targetAgent: string) => {
      if (targetAgent === currentAgent || isLoading) return;
      setLastResponseId(null);
      handleAgentSwitch(targetAgent);
    },
    [currentAgent, isLoading, handleAgentSwitch],
  );

  const handleNewConversation = useCallback(() => {
    abortControllerRef.current?.abort();
    endStreaming();
    sessionIdRef.current = generateSessionId();
    resetAgent();
    setLastResponseId(null);
    setResumeText(null);
    setAttachedFile(null);
    setInput("");
    setIsLoading(false);
    setStatusKey(null);
    setMessages([
      {
        id: nextMessageId(),
        role: "assistant",
        content: t("chat.welcome"),
        agentName: AGENT_NAMES.TRIAGE,
        timestamp: Date.now(),
      },
    ]);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [t, resetAgent, endStreaming]);

  /** 진행 중인 응답 중단 */
  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
    setStatusKey(null);
    /* 중단된 턴은 OpenAI 측 응답 체인에 기록되지 않습니다. 체인을 그대로 두면
     * 다음 턴은 마지막 사용자 메시지 하나만 서버로 보내고, 방금 중단된 질문과
     * 부분 응답은 화면에는 보이는데 모델의 기억에는 없는 상태가 됩니다
     * ("아까 그거 이어서 해줘"가 통하지 않음). 체인을 비우면 다음 턴이
     * 화면에 보이는 전체 이력을 보내므로, 보이는 것과 모델이 아는 것이
     * 다시 일치합니다. */
    setLastResponseId(null);
    const id = streamingIdRef.current;
    endStreaming();
    // 델타가 오기 전에 중단했으면 빈 말풍선을 지우고, 부분 응답은 남깁니다.
    if (id) {
      setMessages((prev) =>
        prev
          .filter((m) => !(m.id === id && !m.content))
          .map((m) => (m.id === id ? { ...m, streaming: false } : m)),
      );
    }
  }, [endStreaming]);

  /** id로 메시지를 찾아 수정한다 — 위치에 의존하지 않습니다 */
  const updateMessage = useCallback(
    (id: string, patch: (m: ChatMessage) => ChatMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? patch(m) : m)));
    },
    [],
  );

  /** 버퍼에 쌓인 델타를 스트리밍 중인 말풍선에 반영 */
  const flushDeltas = useCallback(() => {
    const id = streamingIdRef.current;
    const chunk = deltaBufferRef.current;
    // 버퍼는 대상 유무와 관계없이 항상 비웁니다 — 남겨 두면 다음 턴에 붙습니다.
    deltaBufferRef.current = "";
    if (!chunk || !id) return;
    updateMessage(id, (m) => ({ ...m, content: m.content + chunk }));
  }, [updateMessage]);

  const send = useCallback(
    async (
      text: string,
      attachedResumeText: string | null,
      fileName: string | null,
      /**
       * 재시도 시 사용할 대화 이력.
       *
       * `setMessages`는 비동기라, 재시도가 실패한 메시지를 지운 직후 `send`를
       * 호출하면 `send`는 **지우기 전 배열**을 봅니다. 그래서 같은 사용자 메시지가
       * 모델에게 두 번 전달됐습니다. 정리된 배열을 명시적으로 넘겨 해결합니다.
       */
      historyOverride?: ChatMessage[],
    ) => {
      const now = Date.now();
      lastSendTimeRef.current = now;
      lastSendRef.current = { text, resumeText: attachedResumeText, fileName };
      endStreaming();

      const userMsg: ChatMessage = {
        id: nextMessageId(),
        role: "user",
        content: text,
        timestamp: now,
        ...(fileName ? { attachedFileName: fileName } : {}),
      };

      // 사용자 메시지 + 빈 assistant 메시지(스트리밍 대상)를 함께 추가
      const baseMessages = historyOverride ?? messages;
      const history = [...baseMessages, userMsg]
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
        // 서버가 어차피 이 개수만 쓰고, 무제한으로 보내면 긴 세션에서
        // 본문 1MB 상한(413)에 걸려 이후 모든 전송이 실패합니다.
        .slice(-MAX_HISTORY_MESSAGES);

      const assistantId = nextMessageId();
      streamingIdRef.current = assistantId;
      setMessages((prev) => [
        ...(historyOverride ?? prev),
        userMsg,
        { id: assistantId, role: "assistant", content: "", agentName: currentAgent, streaming: true },
      ]);
      setIsLoading(true);
      setStatusKey("status.thinking");
      if (textareaRef.current) textareaRef.current.style.height = "auto";

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // 병합 기준점을 고정합니다 (이후 사용자가 패널에서 고쳐도 이 값은 그대로).
      const sentDoc = resume.doc;
      sentDocRef.current = sentDoc;

      try {
        await streamAgent(
          {
            messages: history,
            sessionId: sessionIdRef.current,
            resumeDoc: resume.doc,
            ...(attachedResumeText ? { resumeText: attachedResumeText } : {}),
            ...(lastResponseId ? { lastResponseId } : {}),
            ...(currentAgent ? { activeAgentName: currentAgent } : {}),
            language: locale,
          },
          {
            onAgent: (name) => {
              handleAgentSwitch(name);
              updateMessage(assistantId, (m) => ({ ...m, agentName: name }));
            },

            onTool: (tool, phase) => {
              setStatusKey(phase === "start" ? toolStatusKey(tool) : "status.thinking");
            },

            onResume: (doc) => {
              // 오류로 끝나도 이력서 편집분은 살립니다.
              resume.applyServerDoc(sentDoc, doc);
              setPanelOpen(true);
            },

            onDelta: (chunk) => {
              deltaBufferRef.current += chunk;
              cancelAnimationFrame(flushRafRef.current);
              flushRafRef.current = requestAnimationFrame(flushDeltas);
            },

            onDone: (payload) => {
              cancelAnimationFrame(flushRafRef.current);
              flushDeltas();
              streamingIdRef.current = null;

              if (payload.lastResponseId) setLastResponseId(payload.lastResponseId);

              // 서버가 알려준 "실제로 일한 에이전트"만 완료로 표시합니다.
              if (payload.completedAgents?.length) {
                setCompletedAgents((prev) => [
                  ...prev,
                  ...payload.completedAgents!.filter((a) => !prev.includes(a)),
                ]);
              }
              // 서버가 이력서를 수정했으면 반영 (사용자 편집분과 병합된 최신본)
              if (payload.resumeDoc) {
                // 응답을 기다리는 20~40초 사이에 사용자가 패널에서 고친 내용을
                // 서버 응답이 덮어쓰지 않도록 3-way 병합합니다.
                resume.applyServerDoc(sentDoc, payload.resumeDoc);
                setPanelOpen(true);
              }

              updateMessage(assistantId, (m) => ({
                ...m,
                // 델타가 하나도 안 온 경우(도구만 실행) 최종 출력으로 대체
                content: m.content || payload.output,
                agentName: payload.activeAgent,
                structuredData: payload.structuredData?.length ? payload.structuredData : undefined,
                timestamp: Date.now(),
                streaming: false,
              }));
            },

            onError: (rawMessage) => {
              const message =
                rawMessage === 'STREAM_TRUNCATED' ? t('chat.error') : rawMessage;
              endStreaming();
              /* 실패한 턴은 응답 체인에 없습니다 (handleStop과 같은 이유).
               * 체인을 비워 다음 턴이 화면의 전체 이력을 보내게 합니다. */
              setLastResponseId(null);
              setMessages((prev) => [
                // 내용이 하나도 없는 빈 말풍선은 제거하고, 부분 응답은 남깁니다.
                ...prev.filter((m) => !(m.id === assistantId && !m.content)),
                { id: nextMessageId(), role: "system", content: message, isError: true },
              ]);
            },
          },
          controller.signal,
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error(err);
        setMessages((prev) => [
          ...prev.filter((m) => !(m.id === assistantId && !m.content)),
          { id: nextMessageId(), role: "system", content: t("chat.error"), isError: true },
        ]);
      } finally {
        setIsLoading(false);
        setStatusKey(null);
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
    },
    [messages, currentAgent, lastResponseId, locale, t, resume, handleAgentSwitch, flushDeltas, updateMessage, endStreaming],
  );

  const sendMessage = useCallback(() => {
    const trimmed = input.trim();
    if ((!trimmed && !resumeText) || isLoading) return;

    // 쿨다운은 입력창을 비우기 **전에** 확인합니다.
    // (예전에는 send() 안에서 조용히 return 해서, 연속 전송 시 메시지와
    //  첨부한 PDF가 아무 안내 없이 사라졌습니다.)
    if (Date.now() - lastSendTimeRef.current < SEND_COOLDOWN_MS) return;

    const text = trimmed || t("chat.analyzeAuto");
    const captured = resumeText;
    const file = attachedFile;

    setInput("");
    setAttachedFile(null);
    setResumeText(null);

    void send(text, captured, file);
  }, [input, resumeText, attachedFile, isLoading, t, send]);

  /**
   * 직전 전송을 그대로 재현한다.
   *
   * 예전에는 마지막 사용자 메시지를 찾아 `send()`에 넘겼는데, `send()`가 사용자
   * 말풍선을 다시 추가하므로 **같은 메시지가 두 번** 보였고, 첨부했던 이력서
   * 텍스트는 `null`로 넘겨서 영영 사라졌습니다.
   * 이제 원본 인자를 보관해 두었다가 실패한 말풍선만 지우고 replay합니다.
   */
  const handleRetry = useCallback(() => {
    if (isLoading) return;
    const prevSend = lastSendRef.current;
    if (!prevSend) return;

    /* 실패한 교환을 통째로 잘라냅니다.
     * 마지막 사용자 메시지까지 되짚어 올라가 그 지점부터 버립니다 —
     * 부분 응답이 남아 있어도 확실히 제거됩니다.
     * (이전 구현은 내용이 있는 assistant 말풍선을 만나면 멈춰서 사용자
     *  메시지를 남겼고, 결과적으로 같은 메시지가 두 번 보였습니다.) */
    const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");
    const cleaned = lastUserIdx >= 0 ? messages.slice(0, lastUserIdx) : messages;

    setMessages(cleaned);
    void send(prevSend.text, prevSend.resumeText, prevSend.fileName, cleaned);
  }, [isLoading, messages, send]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      /* 한국어 IME 조합을 확정하는 Enter까지 전송으로 처리하면 안 됩니다.
       * 조합 중 Enter는 isComposing=true(크롬은 keyCode 229)로 오는데,
       * 이걸 그대로 보내면 조합 중이던 마지막 음절이 입력창에 남거나
       * 메시지가 두 번 전송됩니다 — 한국어 입력의 고전적인 버그입니다. */
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      sendMessage();
    }
  };

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
    <div className="flex flex-1 min-h-0 flex-col md:flex-row">
      {/* ── 사이드바 ── */}
      <aside
        className={`w-full shrink-0 md:w-56 lg:w-60 overflow-y-auto border-b md:border-b-0 md:border-r border-surface-border glass ${
          keyboardOpen ? "hidden md:block" : ""
        }`}
      >
        <AgentStatusPanel
          currentAgent={currentAgent}
          completedAgents={completedAgents}
          onAgentSelect={handleManualAgentSwitch}
          onNewConversation={handleNewConversation}
          isLoading={isLoading}
        />
      </aside>

      {/* ── 채팅 영역 ── */}
      <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-label={t("chat.messageList")}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 custom-scrollbar"
        >
          {messages.length > MAX_RENDERED_MESSAGES && (
            <div className="flex justify-center py-2">
              <span className="text-[11px] text-text-secondary/60">
                {t("chat.olderHidden", {
                  count: String(messages.length - MAX_RENDERED_MESSAGES),
                })}
              </span>
            </div>
          )}

          {visibleMessages.map((msg) => (
            <div key={msg.id} className="space-y-3">
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

              {msg.structuredData?.map((sd, i) => (
                <div key={i} className="max-w-[90%] sm:max-w-[80%]">
                  <StructuredDataBlock data={sd} />
                </div>
              ))}

              {/* 내용이 있거나, 스트리밍 중이 아닌 메시지만 렌더 */}
              {(msg.content || !msg.streaming) && (
                <MessageBubble
                  role={msg.role}
                  content={msg.content}
                  agentName={msg.agentName}
                  isSystem={msg.role === "system"}
                  timestamp={msg.timestamp}
                  streaming={msg.streaming}
                />
              )}

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
            </div>
          ))}

          {/* 진행 상태 — 어떤 작업 중인지 알려줍니다 */}
          {isLoading && statusKey && (
            <div className="flex justify-start" role="status">
              <div className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-elevated px-3.5 py-1.5">
                <span className="flex gap-1">
                  <span className="h-1 w-1 rounded-full bg-accent/70 animate-bounce" />
                  <span className="h-1 w-1 rounded-full bg-accent/70 animate-bounce [animation-delay:150ms]" />
                  <span className="h-1 w-1 rounded-full bg-accent/70 animate-bounce [animation-delay:300ms]" />
                </span>
                <span className="text-[11px] text-text-secondary">{t(statusKey)}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── 입력 영역 ── */}
        <div className="shrink-0 border-t border-surface-border bg-surface/80 backdrop-blur px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
              className="shrink-0 flex h-11 w-11 items-center justify-center rounded-lg border border-surface-border text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary hover:border-accent/30"
              title={t("chat.pdfTooltip")}
              aria-label={t("chat.pdfTooltip")}
            >
              <Paperclip className="h-5 w-5" />
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
              className="flex-1 resize-none rounded-xl border border-surface-border bg-surface-elevated px-4 py-2.5 text-base sm:text-sm text-text-primary placeholder:text-text-secondary/50 outline-none transition-colors focus:border-accent/40 focus:ring-1 focus:ring-accent/20"
            />

            {/* 모바일 이력서 패널 토글 */}
            <button
              onClick={() => setPanelOpen((v) => !v)}
              className="shrink-0 md:hidden flex h-11 w-11 items-center justify-center rounded-lg border border-surface-border text-text-secondary transition-colors hover:border-accent/30 hover:text-accent"
              aria-label={panelOpen ? t("resume.hide") : t("resume.show")}
              aria-expanded={panelOpen}
            >
              <PanelRight className="h-5 w-5" />
            </button>

            {isLoading ? (
              <button
                onClick={handleStop}
                className="shrink-0 flex h-11 w-11 items-center justify-center rounded-lg border border-surface-border text-text-secondary transition-colors hover:border-accent/40 hover:text-accent"
                aria-label={t("chat.stop")}
                title={t("chat.stop")}
              >
                <Square className="h-4 w-4" fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={sendMessage}
                disabled={!input.trim() && !resumeText}
                className="shrink-0 flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-surface transition-all hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                aria-label={t("chat.send")}
              >
                <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 이력서 패널 ──
          데스크톱: 우측 고정 컬럼 / 모바일: 토글 오버레이 */}
      <aside
        ref={panelRef}
        className={`
          border-surface-border bg-surface
          ${panelOpen ? "fixed inset-0 z-40 flex flex-col" : "hidden"}
          md:static md:z-auto md:flex md:w-80 lg:w-96 md:shrink-0 md:flex-col md:border-l
          ${keyboardOpen ? "md:flex" : ""}
        `}
        role={panelIsModal ? "dialog" : undefined}
        aria-modal={panelIsModal || undefined}
        aria-label={t("resume.title")}
      >
        {/* 모바일 닫기 바 */}
        {panelOpen && (
          <div className="flex items-center justify-between border-b border-surface-border px-4 py-3 md:hidden">
            <span className="text-sm font-semibold">{t("resume.title")}</span>
            <button
              onClick={closePanel}
              className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-elevated"
              aria-label={t("resume.hide")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1">
          <ResumePanel
            doc={resume.doc}
            reset={resume.reset}
            completeness={resume.completeness}
            setBasicsField={resume.setBasicsField}
            patch={resume.patch}
            upsertItem={resume.upsertItem}
            removeItem={resume.removeItem}
          />
        </div>
      </aside>
    </div>
  );
}
