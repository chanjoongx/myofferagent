/**
 * URL 안전성 검증
 * ------------------------------------------------------------------
 * 이 함수는 두 가지를 동시에 막습니다:
 *
 * 1. **위험한 스킴** — `javascript:`, `data:`, `vbscript:` 등
 * 2. **절대 URL이 아닌 값** — 빈 문자열, `#`, `www.example.com` 같은 값
 *
 * ⚠️ 2번이 실제 사고를 냈습니다.
 * 예전 구현은 `new URL(url, 'https://placeholder.com')`처럼 **기준 URL을
 * 함께 넘겨서**, 빈 문자열이나 스킴 없는 값도 "유효"하다고 판정했습니다.
 * 그 결과 링크가 없는 채용공고에 `href=""`가 붙었고, 사용자가 "공고 보기"를
 * 누르면 **현재 페이지가 새로고침**됐습니다. 채팅 메시지는 메모리에만
 * 있으므로 **대화 전체가 사라졌습니다.**
 *
 * 기준 URL 없이 파싱하면 절대 URL만 통과합니다.
 */
export function isSafeUrl(url: string): boolean {
  if (typeof url !== 'string' || url.trim().length === 0) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    // 상대 경로·빈 값·형식 오류는 여기로 떨어집니다.
    return false;
  }
}
