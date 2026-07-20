/**
 * 중앙 모델 설정
 * ------------------------------------------------------------------
 * 모델명을 한 곳에서 관리하고, **환경변수로 재정의**할 수 있게 합니다.
 * 새 모델이 나와도 코드 수정 없이 `wrangler secret` / `.env.local`만 바꾸면 됩니다.
 *
 * ⚠️ 검증 메모 (2026-07 기준)
 * 아래 기본값은 이 프로젝트 API 키로 `GET /v1/models`를 호출해
 * **실제 사용 가능 목록에 존재함을 확인한** 이름입니다.
 * 다만 해당 키에 크레딧이 없어(insufficient_quota) **실제 추론 호출까지는
 * 검증하지 못했습니다.** 쿼터 복구 후 `npm run check:models`로 확인하세요.
 *
 * 이전 값이던 `gpt-4o` / `gpt-4o-mini`는 세대가 여러 번 지난 모델입니다.
 */

/** `/v1/models`에서 존재를 확인한 대안들 — 필요하면 환경변수로 교체하세요. */
export const KNOWN_MODELS = {
  /** 최신 계열. luna/sol/terra의 포지셔닝은 공개 문서로 확인하지 못했습니다. */
  newest: ['gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-5.6-luna'],
  /** 메인라인 — 기본값으로 채택 */
  mainline: ['gpt-5.5', 'gpt-5.4'],
  /** 경량 계열 */
  small: ['gpt-5.4-mini', 'gpt-5.4-nano'],
} as const;

function envModel(key: string, fallback: string): string {
  const value = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

export const MODEL_CONFIG = {
  /** 파싱·불릿 개선 등 빠르고 저렴해야 하는 작업 */
  fast: envModel('OPENAI_MODEL_FAST', 'gpt-5.4-mini'),

  /** 에이전트 추론, ATS 분석, 매칭 등 품질이 중요한 작업 */
  standard: envModel('OPENAI_MODEL_STANDARD', 'gpt-5.5'),
} as const;

export type ModelKey = keyof typeof MODEL_CONFIG;
