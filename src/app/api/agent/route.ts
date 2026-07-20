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

/* ── 입력 길이 상한 ──
 * 컨텍스트 폭주와 비용 증폭을 막습니다. Job Scout은 한 턴에 유료 웹 검색을
 * 여러 번 호출하므로, 거대한 입력 × 많은 턴 × 분당 20회는 실제 비용 위험입니다. */
const MAX_RESUME_TEXT = 60_000;
const MAX_MESSAGE_CHARS = 12_000;

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
     * 실제로 읽은 바이트 수로 판정합니다. */
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
    const messages = body.messages
      .filter(
        (m): m is { role: 'user' | 'assistant'; content: string } =>
          !!m && typeof m === 'object' && typeof m.content === 'string',
      )
      .slice(-MAX_MESSAGES)
      .map((m) => ({
        role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: m.content.slice(0, MAX_MESSAGE_CHARS),
      }));

    language = body.language && VALID_LANGUAGES.has(body.language) ? body.language : 'ko';

    const resumeText =
      typeof body.resumeText === 'string' && body.resumeText.trim().length >= MIN_RESUME_LENGTH
        ? body.resumeText.trim().slice(0, MAX_RESUME_TEXT)
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
      const last = turnMessages[turnMessages.length - 1];
      turnMessages[turnMessages.length - 1] = {
        ...last,
        content: `${last.content}\n\n${fence('RESUME_TEXT', resumeText, { maxLength: MAX_RESUME_TEXT })}`,
      };
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

    console.log(
      `[POST /api/agent] session=${body.sessionId} agent=${startAgent.name} ` +
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
                  send({ type: 'tool_start', tool: rawItem?.name ?? 'tool' });
                } else if (event.name === 'tool_output') {
                  const rawItem = event.item.rawItem as { name?: string };
                  send({ type: 'tool_end', tool: rawItem?.name ?? 'tool' });
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
              : JSON.stringify(streamed.finalOutput ?? ''));

          send({
            type: 'done',
            payload: {
              output: finalOutput,
              activeAgent: streamed.currentAgent?.name ?? activeAgent,
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
