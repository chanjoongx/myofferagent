/**
 * 수치 날조 방지 (순수 로직)
 * ------------------------------------------------------------------
 * `server-only`를 import하지 않습니다 — 그래야 단위 테스트가 가능합니다.
 * (`intent.ts`와 같은 이유입니다. 이 프로젝트의 아키텍처 규칙 1번 참고.)
 */

/* ────────────────────────────────────────────
   수치 날조 방지 (프롬프트가 아니라 코드로 강제)
   ──────────────────────────────────────────── */

/** 숫자 토큰: 42, 3.8, 40%, 12k, 3x, 1,200 등 */
const NUMBER_TOKEN = /\d+(?:[.,]\d+)*\s*(?:%|k\b|m\b|x\b|배)?/gi;

function numbersIn(text: string): Set<string> {
  const found = text.match(NUMBER_TOKEN) ?? [];
  return new Set(found.map((n) => n.replace(/[\s,]/g, '').toLowerCase()));
}

/**
 * 재작성본에 **원문에도 맥락에도 없는 숫자**가 등장하면 날조로 본다.
 *
 * 프롬프트에 "숫자를 지어내지 마세요"라고 적어 두긴 했지만, 같은 프롬프트가
 * "측정 가능한 성과를 앞세우라"고도 시킵니다. 게다가 이 도구는 저렴한 모델에서
 * 돕니다 — 지어낼 유인이 구조적으로 존재합니다.
 *
 * 이력서에 없는 수치가 들어가면 사용자는 **면접에서 그 숫자를 방어할 수
 * 없습니다.** 도움이 아니라 해가 되므로 코드로 막습니다.
 */
export function hasFabricatedNumber(
  original: string,
  context: string,
  rewritten: string,
): boolean {
  const allowed = new Set([...numbersIn(original), ...numbersIn(context)]);
  for (const n of numbersIn(rewritten)) {
    if (!allowed.has(n)) return true;
  }
  return false;
}
