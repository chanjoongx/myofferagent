/**
 * 에이전트 실행 컨텍스트
 * ------------------------------------------------------------------
 * `run(agent, input, { context })`로 주입되어 **모든 도구가 공유**하는 상태입니다.
 * 도구는 `execute(input, runContext)`의 두 번째 인자로 이 객체를 받습니다.
 *
 * ## 이 구조가 해결하는 문제
 *
 * 기존 구현에서 Resume Builder는 대화로 정보를 모은 뒤,
 * `generate_resume_markdown({ resumeJson: "<이력서 전체를 담은 JSON 문자열>" })`를
 * 호출해야 했습니다. 즉 **LLM이 매 호출마다 이력서 전체를 기억에서 다시
 * 직렬화**해야 했고, 한 필드라도 빠뜨리면 그대로 데이터가 유실됐습니다.
 * 게다가 파라미터 타입이 그냥 `string`이라 Zod 검증도 우회됐습니다.
 *
 * 여기서는 이력서 정본이 **서버 컨텍스트에** 있고, 도구는 부분 패치만 적용합니다.
 * LLM은 "이메일이 이거야"만 말하면 되고, 나머지 필드는 코드가 보존합니다.
 *
 * 컨텍스트는 **모델에게 전송되지 않습니다.** 순수한 서버 측 상태이며,
 * 필요한 부분만 도구 반환값과 동적 instructions를 통해 모델에 노출됩니다.
 */

import type { Locale } from '@/lib/i18n';
import type { ATSAnalysis, MatchAnalysis, JobSearchResult } from '@/lib/types';
import { emptyResume, type ResumeDocument } from '@/lib/resume/schema';

export interface AppContext {
  /** 이력서 정본. 도구가 직접 수정합니다. */
  resume: ResumeDocument;

  /** 응답 언어 — 동적 instructions가 참조합니다. */
  locale: Locale;

  /**
   * 요청 취소 신호.
   *
   * 도구가 자체적으로 OpenAI를 호출할 때(analyze_ats, import_resume_text,
   * improve_bullets) 반드시 넘겨야 합니다. 없으면 사용자가 중지를 눌러도
   * 도구 안의 호출은 계속 돌아갑니다 — 재시도 3회 × 45초 타임아웃이면
   * 한 번의 도구 호출이 최악의 경우 2분 넘게 Worker 시간을 태웁니다.
   */
  signal?: AbortSignal;

  /** 이번 턴에 이력서가 변경되었는지 (변경 시에만 클라이언트로 되돌려 보냄) */
  resumeTouched: boolean;

  /**
   * 도구가 만들어 낸 구조화 데이터.
   * 기존에는 도구 출력 문자열을 정규식·JSON.parse로 *추측*해서 뽑아냈지만,
   * 여기서는 도구가 명시적으로 넣어 줍니다.
   */
  emitted: {
    ats: ATSAnalysis | null;
    jobs: JobSearchResult[] | null;
    match: MatchAnalysis | null;
  };
}

export function createContext(init: {
  resume?: ResumeDocument;
  locale?: Locale;
  signal?: AbortSignal;
}): AppContext {
  return {
    resume: init.resume ?? emptyResume(),
    locale: init.locale ?? 'ko',
    signal: init.signal,
    resumeTouched: false,
    emitted: { ats: null, jobs: null, match: null },
  };
}

/**
 * 도구에서 컨텍스트를 꺼낸다.
 *
 * 컨텍스트가 없으면 임시 객체를 만들어 크래시는 피하지만, 그 경우 도구의 이력서
 * 수정은 **아무도 읽지 않는 객체로 사라집니다.** 조용히 넘어가면 원인을 찾기
 * 어려우므로 반드시 로그를 남깁니다 (정상 경로에서는 절대 찍히지 않습니다).
 */
export function ctxOf(runContext: { context?: AppContext } | undefined): AppContext {
  if (!runContext?.context) {
    console.error('[context] 실행 컨텍스트가 없습니다 — 이 턴의 이력서 변경은 유실됩니다');
    return createContext({});
  }
  return runContext.context;
}
