/**
 * Cloudflare Workers 폴리필
 * ------------------------------------------------------------------
 * workerd에는 `AsyncLocalStorage.prototype.enterWith`가 존재하지만 호출하면
 * "not implemented"를 던집니다. SDK가 이를 호출하므로 무력화가 필요합니다.
 *
 * ⚠️ 다만 **무조건** 덮어쓰면 안 됩니다.
 * 기존 코드는 조건 없이 no-op으로 교체했는데, 이 모듈은 `next build`의
 * 페이지 데이터 수집 단계에서도 로드됩니다. 그 결과 Next.js 자신의
 * `workUnitAsyncStorage`가 깨져 빌드가 다음 오류로 실패했습니다:
 *
 *   Error [InvariantError]: Invariant: Expected workUnitAsyncStorage to have a store.
 *   Export encountered an error on /_global-error/page
 *
 * 그래서 **실제로 던지는 런타임에서만** 교체합니다.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
try {
  new AsyncLocalStorage<unknown>().enterWith(undefined);
} catch {
  AsyncLocalStorage.prototype.enterWith = function () {
    // no-op: workerd 전용 — Node에서는 이 분기에 들어오지 않습니다
  };
}

import { run, setTracingDisabled, type AgentInputItem } from '@openai/agents';

import { createContext } from '@/lib/agents/context';
import { routeIntent } from '@/lib/agents/routing';
import { fence } from '@/lib/agents/sanitize';
import { coerceResume } from '@/lib/resume/schema';
import { checkRateLimit } from '@/lib/rate-limit';
import type {
  AgentRequest,
  AgentResponse,
  AgentStreamEvent,
  StructuredData,
} from '@/lib/types';

setTracingDisabled(true);

const VALID_LANGUAGES = new Set(['ko', 'en']);
const MIN_RESUME_LENGTH = 50;
const MAX_MESSAGES = 50;
const MAX_BODY_SIZE = 1_000_000;
const MAX_TURNS = 20;

/* ── 웹 검색 회로 차단기 ──
 * Job Scout의 "검색 3회 제한"은 프롬프트로만 강제되고, 호스티드 웹 검색은
 * 유료입니다. 프롬프트가 무시되면 maxTurns까지 검색을 반복할 수 있어
 * (이론상 요청당 십수 회 × 분당 20요청) 청구서가 그대로 커집니다.
 *
 * 임계값 8의 근거 (2026-07-21 로컬 e2e 실측): gpt-5.5는 프롬프트 상한 3을
 * 무시하고 **한 응답 안에서** 6회까지 검색한 사례가 있습니다. 호스티드 도구는
 * 이벤트가 도착한 시점에 이미 실행된 뒤라, 한 응답 내 버스트는 어차피 중단으로
 * 막을 수 없습니다. 이 차단기의 실제 역할은 **턴을 넘나드는 검색 루프**를
 * 끊는 것이므로, 관측된 버스트(6)보다 높고 폭주(십수 회)보다 훨씬 낮은 8로
 * 둡니다.
 *
 * ⚠️ abort()는 catch가 아니라 **done 경로**로 갑니다. SDK는 중단 시 스트림을
 * 정상 종료하고 `completed`를 resolve하므로, for-await가 끝나고 done 페이로드가
 * 나갑니다(이력서 변경분·수집된 카드 포함). 대신 잘린 응답임을 사용자가 알도록
 * done 직전에 안내 문구를 덧붙입니다. */
const MAX_WEB_SEARCHES_PER_REQUEST = 8;

/* ── 요청 벽시계 상한 ──
 * 개별 도구 호출에는 45초 타임아웃이 있지만, 에이전트 루프 전체에는 상한이
 * 없어 업스트림 스트림이 조용히 멈추면 Worker와 SSE가 한없이 매달릴 수
 * 있습니다. 정상 실행은 1분 안쪽이라, 여유 있는 5분을 넘기면 멈춘 것으로
 * 보고 중단합니다(정상 실행은 절대 여기 닿지 않습니다). */
const REQUEST_DEADLINE_MS = 300_000;

/* ── 입력 길이 상한 ──
 * 컨텍스트 폭주와 비용 증폭을 막습니다. Job Scout은 한 턴에 유료 웹 검색을
 * 여러 번 호출하므로, 거대한 입력 × 많은 턴 × 분당 20회는 실제 비용 위험입니다. */
const MAX_RESUME_TEXT = 60_000;
const MAX_MESSAGE_CHARS = 12_000;
/* 메시지 **합계** 상한. 개별(12k)·개수(50) 상한만으로는 50×12k = 60만 자가
 * 한 요청에 실려 매 턴 재청구됩니다. 합계 상한이 없으면 그게 유일하게 열린
 * 비용 문. 넉넉히 잡아 정상 대화에는 영향이 없지만 최악값을 잘라냅니다. */
const MAX_TOTAL_MESSAGE_CHARS = 48_000;

/** 호출해도 "작업을 완료했다"고 볼 수 없는 조회 전용 도구 */
const READ_ONLY_TOOLS = new Set(['get_resume']);

/** 길이 절삭 시 잘린 서로게이트 쌍(이모지 반쪽)을 남기지 않는다.
 *  slice는 끝에서만 자르므로 짝 잃은 상위 서로게이트만 생길 수 있고, 그 홀로
 *  남은 서로게이트를 OpenAI가 400으로 거부해 전체 실행이 실패합니다. */
function clampText(s: string, max: number): string {
  const cut = s.length > max ? s.slice(0, max) : s;
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
}

/* ────────────────────────────────────────────
   SSE 헬퍼
   ──────────────────────────────────────────── */

function sseText(event: AgentStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  // Cloudflare/nginx 버퍼링 비활성화 — 없으면 스트리밍이 무의미해집니다.
  'X-Accel-Buffering': 'no',
} as const;

function errorResponse(message: string, status: number): Response {
  // 스트림 시작 전 오류도 SSE 이벤트로 내려보내 클라이언트 처리 경로를 하나로 유지합니다.
  return new Response(sseText({ type: 'error', message }), { status, headers: SSE_HEADERS });
}

/* ────────────────────────────────────────────
   POST
   ──────────────────────────────────────────── */

export async function POST(req: Request): Promise<Response> {
  const clientIp =
    // Cloudflare가 엣지에서 덮어쓰므로 위조 불가. 아래 두 개는 비-CF 호스팅용 폴백입니다.
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  let language: 'ko' | 'en' = 'ko';

  try {
    if (await checkRateLimit(clientIp)) {
      return errorResponse('Too many requests', 429);
    }

    /* ── 본문 크기 ──
     * content-length 헤더만 믿으면 안 됩니다. Transfer-Encoding: chunked면
     * 헤더가 아예 없어서 `Number(null ?? 0)` → 0 → 검사를 그냥 통과합니다.
     * 그래서 실제로 읽은 바이트 수로 최종 판정하되, content-length가 **있고**
     * 이미 상한을 넘으면 본문을 통째로 버퍼링하기 전에 빠르게 거절합니다
     * (거대한 POST가 isolate 메모리를 먼저 잡아먹는 것을 막습니다). */
    const declaredLength = Number(req.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_SIZE) {
      return errorResponse('Request body too large', 413);
    }
    const raw = await req.arrayBuffer();
    if (raw.byteLength > MAX_BODY_SIZE) {
      return errorResponse('Request body too large', 413);
    }

    let body: AgentRequest;
    try {
      body = JSON.parse(new TextDecoder().decode(raw)) as AgentRequest;
    } catch {
      return errorResponse('Malformed JSON', 400);
    }

    /* ── 메시지 배열 검증 ──
     * 원소가 객체이고 content가 문자열인지까지 확인합니다.
     * (null 원소 하나로 아래 join이 throw하던 문제) */
    if (!Array.isArray(body.messages)) {
      return errorResponse('messages must be an array', 400);
    }
    const clampedMessages = body.messages
      .filter(
        (m): m is { role: 'user' | 'assistant'; content: string } =>
          !!m && typeof m === 'object' && typeof m.content === 'string',
      )
      .slice(-MAX_MESSAGES)
      .map((m) => ({
        role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: clampText(m.content, MAX_MESSAGE_CHARS),
      }));

    /* 합계 상한: 가장 오래된 메시지부터 버려 총량을 맞춥니다 (마지막 메시지는 항상
     * 유지). 개별·개수 상한만으로는 50×12k = 60만 자가 매 턴 재청구됩니다. */
    let totalChars = clampedMessages.reduce((n, m) => n + m.content.length, 0);
    let dropFrom = 0;
    while (totalChars > MAX_TOTAL_MESSAGE_CHARS && dropFrom < clampedMessages.length - 1) {
      totalChars -= clampedMessages[dropFrom].content.length;
      dropFrom++;
    }
    const messages = dropFrom > 0 ? clampedMessages.slice(dropFrom) : clampedMessages;

    language = body.language && VALID_LANGUAGES.has(body.language) ? body.language : 'ko';

    const resumeText =
      typeof body.resumeText === 'string' && body.resumeText.trim().length >= MIN_RESUME_LENGTH
        ? clampText(body.resumeText.trim(), MAX_RESUME_TEXT)
        : null;

    /* ── 실행 컨텍스트 ──
     * 이력서 정본은 클라이언트가 보관하고 매 턴 되돌려 보냅니다.
     * 사용자가 편집 패널에서 고친 내용도 이 경로로 에이전트에게 전달됩니다. */
    /* 취소 신호는 컨텍스트에 실려 도구까지 전달됩니다 —
     * 도구가 직접 OpenAI를 호출하므로 여기서 끊지 않으면 중지가 무의미합니다. */
    const abort = new AbortController();
    // 이미 중단된 시그널에는 'abort' 이벤트가 **다시 발생하지 않습니다.**
    // 클라이언트가 rate-limit 조회나 본문 읽기 도중에 끊으면, 리스너만 달고
    // 실행은 끝까지 돌아 유료 웹 검색까지 태웠습니다.
    if (req.signal.aborted) abort.abort();
    else req.signal.addEventListener('abort', () => abort.abort(), { once: true });

    const ctx = createContext({
      resume: coerceResume(body.resumeDoc),
      locale: language,
      signal: abort.signal,
    });

    /* ── 시작 에이전트 결정 ── */
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop()?.content ?? '';
    const startAgent = routeIntent({
      message: lastUserMessage,
      activeAgentName: body.activeAgentName,
      hasSession: !!body.lastResponseId,
      hasResumeText: !!resumeText,
    });

    /* ── 모델 입력 구성 ──
     * 세션이 이어지는 중이면 마지막 사용자 메시지만 보냅니다.
     * (이전 맥락은 previousResponseId로 서버 측에 이미 남아 있습니다.)
     * 새 대화면 역할을 보존한 아이템 배열로 보냅니다 — 예전에는 content만
     * 이어 붙여서 어시스턴트의 환영 인사까지 사용자 발화처럼 취급됐습니다. */
    const turnMessages = body.lastResponseId
      ? [{ role: 'user' as const, content: lastUserMessage }]
      : messages;

    if (turnMessages.length === 0 || !turnMessages.some((m) => m.content.trim())) {
      return errorResponse('Empty input', 400);
    }

    if (resumeText) {
      // 데이터 안의 울타리 마커를 제거한 뒤 감쌉니다 (sanitize.fence 참고).
      const fenced = fence('RESUME_TEXT', resumeText, { maxLength: MAX_RESUME_TEXT });
      const last = turnMessages[turnMessages.length - 1];
      /* 반드시 **user** 턴에 붙입니다. 마지막이 assistant면(클라이언트가 순서를
       * 조작한 경우) 이력서를 어시스턴트 자신의 발화로 심는 셈이라 신뢰 등급이
       * 올라갑니다. 그럴 땐 새 user 턴으로 감쌉니다. */
      if (last.role === 'user') {
        turnMessages[turnMessages.length - 1] = { ...last, content: `${last.content}\n\n${fenced}` };
      } else {
        turnMessages.push({ role: 'user' as const, content: fenced });
      }
    }

    // SDK가 요구하는 아이템 형태로 변환 (assistant는 status와 타입이 붙은 content 필요)
    const inputItems: AgentInputItem[] = turnMessages.map((m) =>
      m.role === 'assistant'
        ? {
            role: 'assistant' as const,
            status: 'completed' as const,
            content: [{ type: 'output_text' as const, text: m.content }],
          }
        : { role: 'user' as const, content: m.content },
    );

    // sessionId는 클라이언트가 자유롭게 정하는 유일한 무검증 필드입니다. 줄바꿈을
    // 걷어내고 길이를 잘라 로그 위조·플러딩을 막습니다 (Workers Logs 활성 상태).
    const safeSession = String(body.sessionId ?? '').replace(/[\r\n]+/g, ' ').slice(0, 64);
    console.log(
      `[POST /api/agent] session=${safeSession} agent=${startAgent.name} ` +
        `chained=${!!body.lastResponseId} items=${inputItems.length} locale=${language}`,
    );

    /* ── 스트리밍 실행 ──
     * `signal`을 넘겨야 사용자가 중지를 눌렀을 때 에이전트 루프와 OpenAI 요청이
     * 실제로 끊깁니다. 없으면 화면만 멈추고 서버는 끝까지 돌며 토큰을 태웁니다. */
    const streamed = await run(startAgent, inputItems, {
      context: ctx,
      stream: true,
      maxTurns: MAX_TURNS,
      signal: abort.signal,
      ...(body.lastResponseId ? { previousResponseId: body.lastResponseId } : {}),
    });

    /** 이번 실행에서 도구가 만들어 낸 구조화 데이터를 모두 모은다 */
    const collectStructured = (): StructuredData[] => {
      const out: StructuredData[] = [];
      if (ctx.emitted.jobs) out.push({ type: 'job_results', data: ctx.emitted.jobs });
      if (ctx.emitted.match) out.push({ type: 'match_analysis', data: ctx.emitted.match });
      if (ctx.emitted.ats) out.push({ type: 'ats_analysis', data: ctx.emitted.ats });
      return out;
    };

    const encoderStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        // 클라이언트가 연결을 끊은 뒤 enqueue/close하면 TypeError가 납니다.
        // 중지 버튼을 누를 때마다 unhandled rejection이 나던 원인입니다.
        let closed = false;
        const send = (e: AgentStreamEvent) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(sseText(e)));
          } catch {
            closed = true;
          }
        };

        let activeAgent: string = startAgent.name;
        let text = '';
        let webSearches = 0;
        /* 강제 중단(검색 상한·벽시계) 시 done에 덧붙일 안내. null이면 정상 완료. */
        let terminationNotice: string | null = null;
        const NOTICE = {
          search:
            language === 'en'
              ? '\n\n_(Stopped early: the search limit for one request was reached.)_'
              : '\n\n_(검색 횟수 상한에 도달해 여기서 멈췄습니다.)_',
          timeout:
            language === 'en'
              ? '\n\n_(Stopped early: this request took too long.)_'
              : '\n\n_(응답이 너무 오래 걸려 여기서 멈췄습니다.)_',
        };
        const deadline = setTimeout(() => {
          terminationNotice ??= NOTICE.timeout;
          console.warn('[POST /api/agent] 벽시계 상한 초과 — 실행을 중단합니다');
          abort.abort();
        }, REQUEST_DEADLINE_MS);

        /* 실제로 **의미 있는 작업을 수행한** 에이전트만 기록합니다.
         * 사이드바의 완료 체크가 예전에는 "다른 에이전트로 넘어갔다"는 이유만으로
         * 붙었습니다. Triage에서 인사만 하고 Scout으로 가도 Triage가 완료로
         * 표시돼서, 체크 표시가 진행 상황을 전혀 나타내지 못했습니다. */
        const workedAgents = new Set<string>();

        try {
          send({ type: 'agent', name: activeAgent });

          for await (const event of streamed) {
            switch (event.type) {
              case 'agent_updated_stream_event': {
                // handoff 발생 시점을 실시간으로 알 수 있습니다.
                const name = event.agent?.name;
                if (name && name !== activeAgent) {
                  activeAgent = name;
                  send({ type: 'agent', name });
                }
                break;
              }

              case 'run_item_stream_event': {
                if (event.name === 'tool_called') {
                  const rawItem = event.item.rawItem as { name?: string };
                  const toolName = rawItem?.name ?? 'tool';
                  send({ type: 'tool_start', tool: toolName });
                  if (toolName.includes('search')) {
                    webSearches++;
                    if (webSearches > MAX_WEB_SEARCHES_PER_REQUEST) {
                      console.warn(
                        `[POST /api/agent] 웹 검색 ${webSearches}회 — 상한 초과로 실행을 중단합니다`,
                      );
                      terminationNotice ??= NOTICE.search;
                      abort.abort();
                    }
                  }
                } else if (event.name === 'tool_output') {
                  const rawItem = event.item.rawItem as { name?: string };
                  const toolName = rawItem?.name ?? 'tool';
                  send({ type: 'tool_end', tool: toolName });
                  // 조회 전용 도구는 "작업했다"로 치지 않습니다.
                  if (!READ_ONLY_TOOLS.has(toolName)) workedAgents.add(activeAgent);
                }
                break;
              }

              case 'raw_model_stream_event': {
                const data = event.data as { type?: string; delta?: string };
                if (data.type === 'output_text_delta' && data.delta) {
                  text += data.delta;
                  send({ type: 'delta', text: data.delta });
                }
                break;
              }
            }
          }

          await streamed.completed;

          const finalOutput =
            text ||
            (typeof streamed.finalOutput === 'string'
              ? streamed.finalOutput
              : // 값이 아예 없으면 빈 문자열 — JSON.stringify(undefined ?? '')는
                // 리터럴 큰따옴표 두 글자('""')가 되어 말풍선에 그대로 보입니다.
                // (실측: 검색 차단기가 마지막 요약 생성을 끊은 런에서 발생)
                streamed.finalOutput == null
                ? ''
                : JSON.stringify(streamed.finalOutput));

          // 강제 중단이면 잘린 응답임을 사용자에게 알립니다 (안 그러면 문장이
          // 중간에 끊긴 채 정상 완료처럼 보입니다).
          const outputWithNotice = terminationNotice ? finalOutput + terminationNotice : finalOutput;

          send({
            type: 'done',
            payload: {
              output: outputWithNotice,
              activeAgent: streamed.currentAgent?.name ?? activeAgent,
              completedAgents: [...workedAgents],
              structuredData: collectStructured(),
              ...(ctx.resumeTouched ? { resumeDoc: ctx.resume } : {}),
              ...(streamed.lastResponseId ? { lastResponseId: streamed.lastResponseId } : {}),
            } satisfies AgentResponse,
          });

          /* ── 리포트 도구 누락 감지 ──
           * `report_jobs` / `report_match`는 프롬프트로만 강제됩니다. 모델이
           * 건너뛰면 사용자에게는 카드가 하나도 안 보이는데, 이전에는 그 사실을
           * 아무도 알아채지 못했습니다(조용한 품질 저하). 최소한 로그로 남깁니다. */
          const finalAgent = streamed.currentAgent?.name ?? activeAgent;
          if (finalAgent === 'Job Scout' && !ctx.emitted.jobs) {
            console.warn('[POST /api/agent] Job Scout이 report_jobs를 호출하지 않음 — 공고 카드 없음');
          }
          if (finalAgent === 'Match Strategy' && !ctx.emitted.match) {
            console.warn('[POST /api/agent] Match Strategy가 report_match를 호출하지 않음 — 매칭 카드 없음');
          }

          console.log(
            `[POST /api/agent] 완료 agent=${activeAgent} ` +
              `structured=${collectStructured().length} ` +
              `resumeTouched=${ctx.resumeTouched} outLen=${finalOutput.length}`,
          );
        } catch (err) {
          // 객체 전체를 찍으면 SDK 오류가 요청 조각(이력서 내용 포함)을 흘릴 수 있습니다.
          const name = err instanceof Error ? err.name : 'Error';
          const detail = err instanceof Error ? err.message.slice(0, 300) : '';
          console.error(`[POST /api/agent] 스트림 오류: ${name} — ${detail}`);

          /* ⚠️ 오류가 나도 이력서 변경분은 반드시 돌려보냅니다.
           * 예전에는 error 이벤트만 보내서, maxTurns 초과나 모델 5xx가 나면
           * 그 실행에서 도구가 저장한 이력서 편집이 통째로 사라졌습니다. */
          if (ctx.resumeTouched) {
            send({ type: 'resume', doc: ctx.resume });
          }
          send({
            type: 'error',
            message:
              language === 'en'
                ? 'An unexpected error occurred. Please try again.'
                : '알 수 없는 오류가 발생했습니다. 다시 시도해 주세요.',
          });
        } finally {
          clearTimeout(deadline);
          if (!closed) {
            closed = true;
            try {
              controller.close();
            } catch {
              /* 이미 닫힘 */
            }
          }
        }
      },

      cancel() {
        // 클라이언트가 연결을 끊음 — 진행 중인 에이전트 실행을 실제로 중단시킵니다.
        abort.abort();
        console.log('[POST /api/agent] 클라이언트가 스트림을 취소했습니다');
      },
    });

    return new Response(encoderStream, { headers: SSE_HEADERS });
  } catch (err) {
    const name = err instanceof Error ? err.name : 'Error';
    console.error(`[POST /api/agent] 오류: ${name}`);
    return errorResponse(
      language === 'en'
        ? 'An unexpected error occurred. Please try again.'
        : '알 수 없는 오류가 발생했습니다. 다시 시도해 주세요.',
      500,
    );
  }
}
