// Cloudflare Workers polyfill: enterWith() EXISTS in workerd but throws "not implemented".
// Override it unconditionally before any SDK import.
import { AsyncLocalStorage } from 'node:async_hooks';
AsyncLocalStorage.prototype.enterWith = function () {
  // no-op: workerd has this method but throws when called
};

import { run, RunHandoffOutputItem, RunToolCallOutputItem, setTracingDisabled } from '@openai/agents';
import { triageAgent, getAgentByName, AGENT_NAMES } from '@/lib/agents';
import type { AgentRequest, AgentResponse, StructuredData } from '@/lib/types';

// Tracing도 비활성화 (Workers에서 불필요한 trace 수집 방지)
setTracingDisabled(true);

/* ── 허용 언어 목록 ── */
const VALID_LANGUAGES = new Set(['ko', 'en']);

/* ── 최소 이력서 길이 (의미 있는 텍스트 기준) ── */
const MIN_RESUME_LENGTH = 50;

/* ── 요청 본문 제한 ── */
const MAX_MESSAGES = 50;         // messages 배열 최대 길이
const MAX_BODY_SIZE = 500_000;   // 전체 body 최대 크기 (약 500KB)

/* ── 서버 사이드 Rate Limiting (인메모리) ──
 * 한계:
 *  - 인메모리 Map은 프로세스별이므로 서버리스(Vercel 등) 환경에서는 인스턴스 간 공유 불가
 *  - x-forwarded-for/x-real-ip 헤더는 CDN/프록시(Vercel, Cloudflare)가 sanitize해야 안전
 *  - 프로덕션에서는 Upstash Redis 기반 @upstash/ratelimit 사용 권장
 */
const RATE_LIMIT_WINDOW_MS = 60_000;  // 1분 윈도우
const RATE_LIMIT_MAX = 20;            // 윈도우당 최대 요청 수
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();

  // 만료된 항목 정리 (lazy cleanup)
  if (rateLimitMap.size > 1000) {
    for (const [k, v] of rateLimitMap) {
      if (now > v.resetAt) rateLimitMap.delete(k);
    }
  }

  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false; // 허용
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX; // true = 차단
}

/**
 * newItems 안의 도구 출력(tool call output)을 순회하며
 * ATS 분석·매칭 분석 JSON이 있으면 structuredData로 추출한다.
 * 마크다운 이력서가 있으면 generatedFiles에 담는다.
 */
function extractStructuredPayloads(items: Iterable<unknown>) {
  let structuredData: StructuredData = null;
  const generatedFiles: Array<{ type: string; content: string; fileName: string }> = [];

  for (const item of items) {
    if (!(item instanceof RunToolCallOutputItem)) continue;

    const output = typeof item.output === 'string' ? item.output : JSON.stringify(item.output);
    const toolName = (item.rawItem as { name?: string }).name ?? '';

    // ATS 점수 결과
    if (toolName === 'calculate_ats_score' || (!structuredData && output.includes('"overallScore"'))) {
      try {
        const parsed = JSON.parse(output);
        if (parsed.overallScore != null && parsed.sections) {
          structuredData = { type: 'ats_analysis', data: parsed };
          console.log('[extract] ATS 분석 데이터 발견');
        }
      } catch { /* JSON이 아님 — skip */ }
    }

    // 이력서 마크다운 생성 결과
    if (toolName === 'generate_resume_markdown') {
      const ts = new Date().toISOString().slice(0, 10);
      generatedFiles.push({
        type: 'resume_markdown',
        content: output,
        fileName: `resume_${ts}.md`,
      });
      console.log('[extract] 마크다운 이력서 생성됨');
    }
  }

  return { structuredData, generatedFiles };
}

/**
 * 구조화 데이터(JSON)의 기본 스키마를 검증한다.
 * 잘못된 데이터면 null을 반환해 클라이언트가 깨지지 않게 한다.
 */
function validateStructuredData(data: StructuredData): StructuredData {
  if (!data) return null;

  if (data.type === 'ats_analysis') {
    const d = data.data;
    if (
      typeof d?.overallScore !== 'number' ||
      d.overallScore < 0 ||
      d.overallScore > 100 ||
      typeof d?.sections !== 'object' ||
      !d.sections
    ) {
      console.error('[validate] ATS 데이터 형식 불일치 — 무시');
      return null;
    }
  }

  if (data.type === 'match_analysis') {
    const d = data.data;
    if (
      typeof d?.matchScore !== 'number' ||
      d.matchScore < 0 ||
      d.matchScore > 100
    ) {
      console.error('[validate] Match 데이터 형식 불일치 — 무시');
      return null;
    }
  }

  return data;
}

export async function POST(req: Request) {
  // ── 서버 사이드 Rate Limiting ──
  const clientIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  if (checkRateLimit(clientIp)) {
    return Response.json(
      { output: '', activeAgent: AGENT_NAMES.TRIAGE, structuredData: null, error: 'Too many requests' } satisfies AgentResponse,
      { status: 429 },
    );
  }

  // 언어를 catch 블록에서도 참조하기 위해 try 바깥에 선언
  let language: 'ko' | 'en' = 'ko';

  try {
    // ── 요청 본문 크기 제한 ──
    const contentLength = Number(req.headers.get('content-length') ?? 0);
    if (contentLength > MAX_BODY_SIZE) {
      return Response.json(
        { output: '', activeAgent: AGENT_NAMES.TRIAGE, structuredData: null, error: 'Request body too large' } satisfies AgentResponse,
        { status: 413 },
      );
    }

    const body: AgentRequest = await req.json();

    // ── messages 배열 길이 제한 ──
    if (body.messages && body.messages.length > MAX_MESSAGES) {
      body.messages = body.messages.slice(-MAX_MESSAGES);
    }

    // ── 언어 파라미터 검증 ──
    language = body.language && VALID_LANGUAGES.has(body.language) ? body.language : 'ko';

    // ── 이력서 텍스트 검증 ──
    const resumeText =
      body.resumeText && body.resumeText.trim().length >= MIN_RESUME_LENGTH
        ? body.resumeText.trim()
        : null;

    if (body.resumeText && !resumeText) {
      console.log('[POST /api/agent] 이력서 텍스트가 너무 짧아 무시됨');
    }

    // ── 시작 에이전트 결정 ──
    let startAgent = body.activeAgentName
      ? getAgentByName(body.activeAgentName)
      : triageAgent;

    // ── 스마트 라우팅: 사용자 의도 기반 라우팅 보정 ──
    // LLM(Triage Agent)보다 먼저 서버에서 명확한 의도를 감지하여 올바른 에이전트로 직접 보냄
    const lastMsg = body.messages.filter(m => m.role === 'user').pop()?.content ?? '';
    const wantsSearch = /채용|공고|검색|찾아|잡|인턴|구직|search|find.*job|job.*search|hiring/i.test(lastMsg);
    const wantsBuild = /이력서.{0,4}(만들|작성|써|쓰|생성|없|시작)|resume.{0,4}(create|build|make|write|start)/i.test(lastMsg);
    const wantsAnalyze = /이력서.{0,4}(분석|검토|평가|봐|점수)|ats.{0,4}(분석|점수|score)|resume.{0,4}(analy|review|check)/i.test(lastMsg);
    const hasResumeContent = lastMsg.includes('[이력서 내용]');

    // Job Scout에서 사용자가 공고를 선택/분석 요청 → Match Strategy로 전환
    // 확장된 정규식: "3번", "3번 공고", "3번째", "첫번째", "#3", "analyze job 3" 등
    const wantsJobAnalysis = /(\d{1,2})\s*(번|번째|번\s*공고|번\s*회사|번\s*으로)|(\d{1,2})\s*(분석|선택|지원|매칭|할게|줘|요|해|볼래|골라|보자|좋아|선택할게|알아봐)|(분석|선택|지원|매칭).*(\d{1,2})|(첫|두|세|네|다섯)\s*번째|(analyze|select|pick|choose|option|number|job|#)\s*(\d{1,2})|(\d{1,2})\s*(analyze|select|pick|choose)/i.test(lastMsg);
    // Scout 상태에서 단순 숫자 입력 ("3", "#2", "1번" 등) → 공고 선택으로 간주
    const isBareJobSelection = body.activeAgentName === AGENT_NAMES.SCOUT && /^\s*#?\d+\s*번?\s*$/.test(lastMsg.trim());
    // 커버레터/자기소개서 요청 감지
    const wantsCoverLetter = /커버\s*레터|자기\s*소개서|cover\s*letter|motivation\s*letter/i.test(lastMsg);

    if (body.activeAgentName && body.lastResponseId) {
      // Job Scout에서 공고 선택 → Match Strategy
      if (body.activeAgentName === AGENT_NAMES.SCOUT && (wantsJobAnalysis || isBareJobSelection)) {
        startAgent = getAgentByName(AGENT_NAMES.MATCH);
        console.log('[POST /api/agent] 라우팅 보정(기존 세션): Job Scout → Match Strategy');
      }
      // 커버레터 요청 → Application Writer로 보정
      if (wantsCoverLetter && body.activeAgentName !== AGENT_NAMES.WRITER) {
        startAgent = getAgentByName(AGENT_NAMES.WRITER);
        console.log('[POST /api/agent] 라우팅 보정(기존 세션): → Application Writer');
      }
      // 검색 불가능한 에이전트에서 검색 요청 → Job Scout로 보정
      const cannotSearchSet = new Set<string>([AGENT_NAMES.MATCH, AGENT_NAMES.WRITER, AGENT_NAMES.ANALYZER, AGENT_NAMES.BUILDER]);
      const cannotSearch = !!body.activeAgentName && cannotSearchSet.has(body.activeAgentName);
      if (wantsSearch && cannotSearch) {
        startAgent = getAgentByName(AGENT_NAMES.SCOUT);
        console.log('[POST /api/agent] 라우팅 보정(기존 세션): → Job Scout');
      }
    } else if (!body.lastResponseId) {
      // 첫 메시지: 명확한 의도가 감지되면 Triage를 건너뛰고 바로 해당 에이전트로
      if (wantsCoverLetter) {
        startAgent = getAgentByName(AGENT_NAMES.WRITER);
        console.log('[POST /api/agent] 라우팅 보정(첫 메시지): → Application Writer');
      } else if (wantsSearch) {
        startAgent = getAgentByName(AGENT_NAMES.SCOUT);
        console.log('[POST /api/agent] 라우팅 보정(첫 메시지): → Job Scout');
      } else if (hasResumeContent || wantsAnalyze) {
        startAgent = getAgentByName(AGENT_NAMES.ANALYZER);
        console.log('[POST /api/agent] 라우팅 보정(첫 메시지): → Resume Analyzer');
      } else if (wantsBuild) {
        startAgent = getAgentByName(AGENT_NAMES.BUILDER);
        console.log('[POST /api/agent] 라우팅 보정(첫 메시지): → Resume Builder');
      }
    }

    // ── 입력 구성 ──
    let input: string;

    if (body.lastResponseId) {
      const lastUserMsg = body.messages.filter(m => m.role === 'user').pop();
      input = lastUserMsg?.content ?? '';
    } else {
      input = body.messages.map((m) => m.content).join('\n');
    }

    if (resumeText) {
      input += '\n\n[이력서 내용]\n' + resumeText;
    }

    // ── 언어 설정 ──
    if (language === 'en') {
      input = `⚠️ CRITICAL LANGUAGE OVERRIDE: You MUST respond ENTIRELY in English. This overrides ALL other language instructions including "한국어로 대화하세요". Every word of your response — greetings, explanations, analysis, suggestions, formatting, questions — must be in English. Do NOT use Korean at all.\n\n${input}`;
    }

    console.log(
      `[POST /api/agent] session=${body.sessionId}, agent=${startAgent.name}, ` +
      `hasResponseId=${!!body.lastResponseId}, inputLen=${input.length}`
    );

    // ── 에이전트 실행 (대화 체인 연결) ──
    const result = await run(startAgent, input, {
      ...(body.lastResponseId ? { previousResponseId: body.lastResponseId } : {}),
    });

    // ── 활성 에이전트 추적 ──
    // 핸드오프가 있었으면 마지막 핸드오프 대상이 활성 에이전트
    let activeAgent = startAgent.name;
    for (const item of result.newItems) {
      if (item instanceof RunHandoffOutputItem) {
        activeAgent = item.targetAgent?.name ?? activeAgent;
      }
    }

    // ── finalOutput 문자열화 ──
    const rawOutput =
      typeof result.finalOutput === 'string'
        ? result.finalOutput
        : JSON.stringify(result.finalOutput);

    // ── 도구 결과에서 구조화 데이터 & 생성 파일 추출 ──
    const { structuredData, generatedFiles } = extractStructuredPayloads(result.newItems);

    // finalOutput 자체가 JSON일 수도 있으니 fallback 체크
    let finalStructured: StructuredData = structuredData;
    if (!finalStructured) {
      try {
        const parsed = JSON.parse(rawOutput);
        if (parsed?.overallScore != null && parsed?.sections) {
          finalStructured = { type: 'ats_analysis', data: parsed };
        } else if (parsed?.matchScore != null) {
          finalStructured = { type: 'match_analysis', data: parsed };
        }
      } catch {
        // 일반 텍스트 — structuredData 없음
      }
    }

    // ── 구조화 데이터 검증 ──
    finalStructured = validateStructuredData(finalStructured);

    // ── lastResponseId 추출 ──
    // @openai/agents의 RunResult에 런타임으로 lastResponseId가 존재 — 안전한 타입 체크
    const lastResponseId = (() => {
      const val = (result as unknown as Record<string, unknown>).lastResponseId;
      return typeof val === 'string' ? val : undefined;
    })();

    const response: AgentResponse = {
      output: rawOutput,
      activeAgent,
      structuredData: finalStructured,
      ...(lastResponseId ? { lastResponseId } : {}),
      ...(generatedFiles.length > 0 ? { generatedFiles } : {}),
    };

    console.log(
      `[POST /api/agent] 완료 — agent=${activeAgent}, ` +
      `structured=${finalStructured?.type ?? 'none'}, ` +
      `files=${generatedFiles.length}, ` +
      `responseId=${lastResponseId ? lastResponseId.slice(0, 20) + '...' : 'none'}`
    );
    return Response.json(response);
  } catch (err) {
    console.error('[POST /api/agent] 에러:', err);

    // 클라이언트 언어에 맞춰 에러 메시지 반환
    const fallbackMsg = language === 'en'
      ? 'An unexpected error occurred. Please try again.'
      : '알 수 없는 오류가 발생했습니다. 다시 시도해 주세요.';

    return Response.json(
      { output: fallbackMsg, activeAgent: AGENT_NAMES.TRIAGE, structuredData: null } satisfies AgentResponse,
      { status: 500 },
    );
  }
}
