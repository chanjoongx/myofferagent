import 'server-only';

/**
 * 레이트 리미팅
 * ------------------------------------------------------------------
 * 기존 구현은 모듈 스코프의 `Map`을 썼습니다. 로컬에서는 동작하지만
 * **Cloudflare Workers에서는 사실상 무력합니다**: 각 요청이 여러 isolate 중
 * 하나에 배정되고, isolate는 수시로 생성·폐기되므로 카운터가 공유되지 않습니다.
 * 공격자는 그냥 요청을 반복하기만 하면 매번 새 카운터를 받습니다.
 *
 * 여기서는 **Cloudflare의 Rate Limiting 바인딩**을 사용합니다 — 엣지에서
 * 전역으로 집계되는 네이티브 기능입니다. 바인딩이 없는 환경(로컬 `next dev`,
 * 다른 호스팅)에서는 인메모리 방식으로 자동 강등되며, 그 사실을 로그로 알립니다.
 *
 * 활성화하려면 `wrangler.toml`에 다음을 추가하세요:
 *
 *   [[unsafe.bindings]]
 *   name = "RATE_LIMITER"
 *   type = "ratelimit"
 *   namespace_id = "1001"
 *   simple = { limit = 20, period = 60 }
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

/* ── 인메모리 폴백 ── */
const memory = new Map<string, { count: number; resetAt: number }>();

function checkMemory(key: string): boolean {
  const now = Date.now();

  // 만료 항목 정리 (지연 정리)
  if (memory.size > 1_000) {
    for (const [k, v] of memory) {
      if (now > v.resetAt) memory.delete(k);
    }
  }

  const entry = memory.get(key);
  if (!entry || now > entry.resetAt) {
    memory.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > MAX_REQUESTS;
}

/** Cloudflare Rate Limiting 바인딩 인터페이스 */
interface RateLimiterBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

let warnedAboutFallback = false;

/**
 * 요청을 차단해야 하면 `true`를 반환한다.
 *
 * 바인딩을 못 찾아도 절대 throw하지 않습니다 — 레이트 리미터의 장애가
 * API 전체 장애로 번지면 안 됩니다.
 */
export async function checkRateLimit(key: string): Promise<boolean> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const env = getCloudflareContext().env as unknown as Record<string, unknown>;
    const limiter = env?.RATE_LIMITER as RateLimiterBinding | undefined;

    if (limiter && typeof limiter.limit === 'function') {
      const { success } = await limiter.limit({ key });
      return !success;
    }
  } catch {
    // Workers 환경이 아니거나 바인딩 미설정 — 폴백으로 진행
  }

  if (!warnedAboutFallback) {
    warnedAboutFallback = true;
    console.warn(
      '[rate-limit] RATE_LIMITER 바인딩을 찾지 못해 인메모리 폴백을 사용합니다. ' +
        'Workers 프로덕션에서는 isolate별로 동작하므로 신뢰할 수 없습니다.',
    );
  }
  return checkMemory(key);
}
