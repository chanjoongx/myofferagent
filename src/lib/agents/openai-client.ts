import 'server-only';

/**
 * OpenAI Chat Completions 클라이언트
 * ------------------------------------------------------------------
 * 도구들이 공유하는 저수준 호출 헬퍼입니다.
 *
 * 기존 `callOpenAI` 대비 달라진 점:
 *  1. **타임아웃** — 기존에는 없었습니다. Workers는 요청이 매달려 있으면
 *     CPU/wall-time 한도를 그대로 태우므로 AbortSignal로 반드시 끊습니다.
 *  2. **Retry-After 존중** + 지터(jitter) — 재시도가 동시에 몰리는 것을 막습니다.
 *  3. **파라미터 자가 복구** — 신형 모델이 `temperature` 같은 파라미터를
 *     거부하면 해당 파라미터를 빼고 한 번 더 시도합니다.
 *     (모델 세대가 바뀔 때 앱이 통째로 죽는 것을 방지)
 *  4. **스키마 복구 재시도** — Zod 검증에 실패하면 검증 오류를 붙여 한 번 더
 *     요청합니다. 기존 구현은 곧바로 throw해서 사용자에게 실패로 보였습니다.
 */

import type { z } from 'zod';

const MAX_RETRIES = 2;
const RETRY_BASE_MS = 800;
const REQUEST_TIMEOUT_MS = 45_000;
const API_URL = 'https://api.openai.com/v1/chat/completions';

export interface CallOptions {
  model: string;
  /** 생성 다양성. 신형 추론 모델은 거부할 수 있어 기본은 미전송입니다. */
  temperature?: number;
  /** 응답 상한. 신형 모델은 `max_completion_tokens`를 씁니다. */
  maxTokens?: number;
  /** JSON 강제 여부 */
  json?: boolean;
  signal?: AbortSignal;
}

class OpenAIError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'OpenAIError';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 지수 백오프 + 지터 */
function backoffMs(attempt: number, retryAfter?: string | null): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 20_000);
  }
  const base = RETRY_BASE_MS * 2 ** attempt;
  return base + Math.random() * base * 0.3;
}

/**
 * 자가 복구로 **제거해도 되는** 파라미터 목록.
 *
 * 예전에는 오류 메시지에서 정규식으로 이름을 뽑아 그대로 `delete` 했습니다.
 * 두 가지가 잘못됐습니다:
 *
 * 1. **무한 루프.** `in` 연산자는 프로토타입 체인까지 훑고 `delete`는 상속된
 *    속성을 지우지 못합니다. 그래서 모델이 `constructor`·`toString`·`__proto__`
 *    같은 이름을 언급하면 조건이 영원히 참이 되고, 이 경로에는 sleep도 없어서
 *    400이 돌아오는 속도로 API를 두들깁니다 (Worker CPU 소진).
 *
 * 2. **엉뚱한 키 삭제.** OpenAI는 실제로 이런 오류를 반환합니다:
 *      "Unsupported value: 'messages[0].role' does not support 'system'…"
 *    정규식은 여기서 `messages`를 뽑아내고, 요청에서 메시지를 통째로 지운 뒤
 *    재시도합니다.
 *
 * 그래서 **명시적 허용 목록**만 제거합니다.
 */
const REMOVABLE_PARAMS = ['temperature', 'max_completion_tokens', 'response_format'] as const;
type RemovableParam = (typeof REMOVABLE_PARAMS)[number];

/** 모델이 지원하지 않는다고 밝힌 파라미터가 제거 가능한 것인지 판별 */
function unsupportedParam(message: string): RemovableParam | null {
  const m = message.match(/unsupported (?:parameter|value)[:\s]+'?([\w.[\]]+)'?/i);
  if (!m) return null;
  // 'reasoning.effort' 처럼 점 표기가 오면 최상위 키만 본다
  const name = m[1].split(/[.[]/)[0];
  return (REMOVABLE_PARAMS as readonly string[]).includes(name)
    ? (name as RemovableParam)
    : null;
}

interface RequestBody {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_completion_tokens?: number;
  response_format?: { type: 'json_object' };
}

/**
 * 원문 텍스트를 반환하는 호출. 재시도·타임아웃·파라미터 복구를 처리합니다.
 */
export async function callText(
  systemPrompt: string,
  userMessage: string,
  options: CallOptions,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다');

  const body: RequestBody = {
    model: options.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  };
  if (options.temperature != null) body.temperature = options.temperature;
  if (options.maxTokens != null) body.max_completion_tokens = options.maxTokens;
  if (options.json) body.response_format = { type: 'json_object' };

  let lastError: Error = new Error('OpenAI 호출 실패');
  // 파라미터 제거 재시도는 재시도 횟수를 소모하지 않으므로 **별도 상한**을 둡니다.
  // (허용 목록 크기만큼만 일어날 수 있지만, 안전망을 명시해 둡니다.)
  let repairsLeft = REMOVABLE_PARAMS.length;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // 호출자 취소와 자체 타임아웃을 함께 건다
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeout])
      : timeout;

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal,
      });

      if (res.ok) {
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || content.length === 0) {
          throw new Error('OpenAI 응답에 content가 없습니다');
        }
        return content;
      }

      const errorText = await res.text();
      let message = errorText;
      let code: string | undefined;
      try {
        const parsed = JSON.parse(errorText) as { error?: { message?: string; code?: string } };
        message = parsed.error?.message ?? errorText;
        code = parsed.error?.code;
      } catch {
        /* 평문 에러 */
      }

      // 지원하지 않는 파라미터 → 제거 후 즉시 재시도 (재시도 횟수 소모 없음)
      const bad = res.status === 400 ? unsupportedParam(message) : null;
      // `in`이 아니라 `Object.hasOwn` — 프로토타입 체인은 delete로 지울 수 없어
      // 조건이 영원히 참으로 남습니다.
      if (bad && repairsLeft > 0 && Object.hasOwn(body, bad)) {
        delete (body as unknown as Record<string, unknown>)[bad];
        repairsLeft--;
        console.warn(`[openai] '${bad}' 미지원 — 제거 후 재시도 (model=${options.model})`);
        attempt--;
        continue;
      }

      lastError = new OpenAIError(message, res.status, code);

      // 429 / 5xx만 재시도 대상
      if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
        await sleep(backoffMs(attempt, res.headers.get('retry-after')));
        continue;
      }
      throw lastError;
    } catch (err) {
      if (err instanceof OpenAIError) throw err;

      lastError = err instanceof Error ? err : new Error(String(err));
      // 호출자가 취소한 경우는 재시도하지 않는다
      if (options.signal?.aborted) throw lastError;

      if (attempt < MAX_RETRIES) {
        await sleep(backoffMs(attempt));
        continue;
      }
    }
  }

  throw lastError;
}

/**
 * JSON을 강제하고 Zod로 검증해 **타입이 보장된 값**을 반환한다.
 *
 * 검증에 실패하면 실패 사유를 프롬프트에 덧붙여 한 번 더 시도합니다 —
 * LLM은 구체적인 오류를 알려주면 대개 두 번째에 맞춥니다.
 */
export async function callJson<T>(
  schema: z.ZodType<T>,
  systemPrompt: string,
  userMessage: string,
  options: CallOptions,
): Promise<T> {
  let repairHint = '';

  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await callText(
      systemPrompt + repairHint,
      userMessage,
      { ...options, json: true },
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      repairHint = `\n\n[재시도] 직전 응답이 유효한 JSON이 아니었습니다. JSON만 출력하세요.`;
      continue;
    }

    const result = schema.safeParse(parsed);
    if (result.success) return result.data;

    const issues = result.error.issues
      .slice(0, 6)
      .map((i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    repairHint = `\n\n[재시도] 직전 응답이 스키마와 맞지 않았습니다. 아래를 고쳐 다시 출력하세요:\n${issues}`;
    console.warn('[openai] 스키마 불일치 — 복구 재시도:', issues);
  }

  throw new Error('모델 응답이 예상 스키마와 일치하지 않습니다');
}
