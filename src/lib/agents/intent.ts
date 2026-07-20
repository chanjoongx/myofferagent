/**
 * 의도 감지 (순수 함수)
 * ------------------------------------------------------------------
 * 에이전트 그래프와 **분리**되어 있습니다. `definitions.ts`는 `server-only`를
 * import하므로, 여기에 함께 두면 이 로직을 단위 테스트할 수 없습니다.
 * 순수 로직과 런타임 의존성을 나누면 가장 오탐이 잦은 부분을 테스트로 고정할 수 있습니다.
 */

import { AGENT_NAMES } from './constants';

export type Intent = 'search' | 'analyze' | 'build' | 'cover_letter';

/* ── 의도 패턴 ──
 * 한국어·영어 모두 지원. 오탐을 줄이기 위해 의도가 분명한 표현만 넣습니다.
 * 우선순위는 배열 순서를 따릅니다. */
const PATTERNS: Array<{ intent: Intent; re: RegExp }> = [
  {
    intent: 'cover_letter',
    re: /커버\s*레터|자기\s*소개서|cover\s*letter|motivation\s*letter/i,
  },
  {
    intent: 'search',
    // 영어 "find/search ... job|internship|position"은 사이에 수식어가 여러 개
    // 올 수 있습니다 ("find me a software engineering internship").
    // 최대 3단어까지 허용하되, 그 이상은 다른 이야기일 가능성이 커서 끊습니다.
    re: /채용\s*공고|공고\s*(검색|찾)|구직|일자리|채용\s*중|인턴십?\s*(찾|검색|자리)|(job|internship|position|role)s?\s*(search|hunt|opening)|(search\s+for|find|looking\s+for)\s+(me\s+)?(a\s+|an\s+|some\s+)?(\w+[\s-]+){0,3}(jobs?|internships?|positions?|roles?)\b|who'?s\s+hiring|hiring\s+(right\s+)?now/i,
  },
  {
    intent: 'analyze',
    re: /이력서.{0,8}(분석|검토|평가|점수|봐\s*줘|리뷰)|ats.{0,8}(분석|점수|score|check)|(analyz|review|scor|evaluat)\w*\s+(my\s+)?resume|resume.{0,12}(analysis|review|score|feedback)/i,
  },
  {
    intent: 'build',
    re: /이력서.{0,8}(만들|작성|써\s*줘|생성|새로|처음부터)|이력서\s*(가\s*)?없|(build|create|make|write|start)\s+(a\s+|my\s+)?resume|resume\s+(builder|from\s+scratch)/i,
  },
];

/**
 * 메시지에서 의도를 감지한다. 감지되지 않으면 null.
 */
export function detectIntent(message: string): Intent | null {
  const text = message.trim();
  if (!text) return null;
  for (const { intent, re } of PATTERNS) {
    if (re.test(text)) return intent;
  }
  return null;
}

/* `cannotHandle`은 삭제했습니다.
 * 대화 도중 에이전트를 강제 전환하던 시절의 잔재이고, routing.ts는 더 이상
 * 그 정책을 쓰지 않습니다. 남겨 두면 이미 폐기된 동작을 설명하는 주석이
 * 코드베이스에 계속 남습니다. */

/** 의도 → 담당 에이전트 이름 */
export const INTENT_AGENT: Record<Intent, string> = {
  search: AGENT_NAMES.SCOUT,
  analyze: AGENT_NAMES.ANALYZER,
  build: AGENT_NAMES.BUILDER,
  cover_letter: AGENT_NAMES.WRITER,
};
