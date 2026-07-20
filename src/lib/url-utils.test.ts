import { describe, it, expect } from 'vitest';
import { isSafeUrl } from './url-utils';

describe('isSafeUrl — 위험한 스킴 차단', () => {
  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'java\tscript:alert(1)',
    ' javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'blob:https://x.com/abc',
    'about:blank',
    'mailto:a@b.com',
  ])('차단: %s', (url) => {
    expect(isSafeUrl(url)).toBe(false);
  });
});

describe('isSafeUrl — 절대 URL이 아닌 값 차단', () => {
  /* 회귀 방지: 예전에는 기준 URL을 함께 넘겨 이 값들이 전부 통과했고,
     `href=""`가 붙은 링크를 누르면 페이지가 새로고침되어 대화가 날아갔습니다. */
  it.each(['', '   ', '#', '/agent', 'www.linkedin.com/jobs/123', 'linkedin.com/in/foo'])(
    '차단: %s',
    (url) => {
      expect(isSafeUrl(url)).toBe(false);
    },
  );

  it('문자열이 아닌 값도 안전하게 처리', () => {
    expect(isSafeUrl(undefined as unknown as string)).toBe(false);
    expect(isSafeUrl(null as unknown as string)).toBe(false);
    expect(isSafeUrl(42 as unknown as string)).toBe(false);
  });
});

describe('isSafeUrl — 정상 URL 허용', () => {
  it.each([
    'https://www.linkedin.com/jobs/view/123',
    'http://example.com',
    'https://example.com/path?q=1#frag',
    'https://sub.domain.co.kr/채용',
  ])('허용: %s', (url) => {
    expect(isSafeUrl(url)).toBe(true);
  });
});
