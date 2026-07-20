#!/usr/bin/env node
/**
 * Cloudflare 배포용 빌드
 * ------------------------------------------------------------------
 * `@opennextjs/cloudflare`는 빌드 시점에 `.env*` 파일을 읽어
 * `.open-next/cloudflare/next-env.mjs`에 **값을 그대로 구워 넣습니다.**
 * 그래서 로컬에서 그냥 빌드하면 `.env.local`의 실제 API 키가
 * 배포되는 워커 번들 안에 들어갑니다.
 *
 * 런타임 우선순위는 다행히 안전합니다 (`init.js`):
 *
 *   for (const [k, v] of Object.entries(env)) process.env[k] = v;  // CF 시크릿 먼저
 *   process.env[k] ??= nextEnvVars[mode][k];                       // 구워진 값은 폴백
 *
 * 즉 `wrangler secret`이 이깁니다. 하지만 그래도 문제가 남습니다:
 *  - 살아 있는 시크릿이 빌드 산출물에 포함됩니다
 *  - 시크릿을 지워도 구워진 값이 조용히 이어받아 **키 교체가 불완전**해집니다
 *
 * 그래서 배포 빌드에서는 `.env.local`을 잠시 치워 둡니다.
 * 런타임 값은 전적으로 `wrangler secret put`으로 설정한 시크릿에서 옵니다.
 */

import { execSync } from 'node:child_process';
import { existsSync, renameSync, readFileSync } from 'node:fs';

/* OpenNext 어댑터는 `.env.local`뿐 아니라 `.env`·`.env.production`·
 * `.env.production.local`을 **모두** 읽어 next-env.mjs에 값을 굽습니다
 * (extract-project-env-vars.js 확인). 하나만 치우면 나머지에 든 시크릿이
 * 그대로 번들에 들어갑니다. 게다가 check-models.mjs가 `.env`도 읽으므로
 * 키가 거기 있을 수 있습니다. 그래서 넷 다 잠시 치웁니다. */
const ENV_FILES = ['.env', '.env.production', '.env.local', '.env.production.local'];
const SUFFIX = '.build-stash';

const stashed = [];
for (const f of ENV_FILES) {
  if (existsSync(f)) {
    renameSync(f, f + SUFFIX);
    stashed.push(f);
  }
}
if (stashed.length) {
  console.log(`[cf-build] 잠시 옮김: ${stashed.join(', ')} — 시크릿이 번들에 구워지지 않도록.`);
}

let failed = false;
try {
  // 인자를 shell로 넘기지 않도록 단일 명령 문자열을 씁니다 (DEP0190 회피).
  execSync('npx @opennextjs/cloudflare build', { stdio: 'inherit' });
} catch {
  failed = true;
} finally {
  for (const f of stashed) renameSync(f + SUFFIX, f);
  if (stashed.length) console.log(`[cf-build] 복원 완료: ${stashed.join(', ')}`);
}

if (failed) process.exit(1);

/* ── 검증: 번들에 시크릿이 남아 있지 않은지 확인 ── */
const generated = '.open-next/cloudflare/next-env.mjs';
if (existsSync(generated)) {
  const contents = readFileSync(generated, 'utf8');
  // 이름 기반 백스톱(넷 다 stash하므로 1차 방어는 위에 있음). 대소문자·숫자를
  // 포함하고 PASSWORD/CREDENTIAL까지 잡도록 넓혔습니다.
  const leaked =
    /"([A-Za-z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)[A-Za-z0-9_]*)":"[^"]{8,}"/i.exec(
      contents,
    );
  if (leaked) {
    console.error(
      `\n[cf-build] 중단: 빌드 산출물에 시크릿이 들어 있습니다 (${leaked[1]}).\n` +
        `  ${generated}를 확인하세요.`,
    );
    process.exit(1);
  }
  console.log('[cf-build] 확인 완료 — 번들에 시크릿 없음.');
}
