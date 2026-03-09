/**
 * URL 안전성 검증 (XSS 방지)
 * http/https 프로토콜만 허용하여 javascript: 등 위험한 URL 차단.
 */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'https://placeholder.com');
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
